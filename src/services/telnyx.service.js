import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const require = createRequire(import.meta.url);

// Telnyx ships a CommonJS default export. Load lazily so the app can boot in
// mock mode even if the package isn't installed yet.
let telnyxClient = null;
function client() {
  if (telnyxClient) return telnyxClient;
  const Telnyx = require('telnyx');
  telnyxClient = Telnyx(env.telnyx.apiKey);
  return telnyxClient;
}

// Provider is "live" only when we have an API key AND global mock is off.
export function telnyxIsLive() {
  return !env.mockProviders && Boolean(env.telnyx.apiKey);
}

/**
 * 1. Search for an available UK local number matching the target area code.
 *    Returns the E.164 phone number string.
 */
export async function searchLocalNumber({ areaCode }) {
  if (!telnyxIsLive()) {
    const mock = `+44${areaCode.replace(/^0/, '')}${Math.floor(100000 + Math.random() * 900000)}`;
    logger.info('[MOCK] telnyx.searchLocalNumber', { areaCode, mock });
    return mock;
  }

  const res = await client().availablePhoneNumbers.list({
    filter: {
      country_code: 'GB',
      national_destination_code: areaCode.replace(/^0/, ''),
      features: ['voice'],
      limit: 1,
      phone_number_type: 'local',
    },
  });

  const first = res?.data?.[0];
  if (!first) {
    const err = new Error(`No available UK numbers for area code ${areaCode}`);
    err.status = 422;
    throw err;
  }
  return first.phone_number;
}

/**
 * 1b. Order the chosen number.
 *     Returns { orderId, phoneNumber, status }.
 */
export async function orderNumber({ phoneNumber, requirementGroupId }) {
  if (!telnyxIsLive()) {
    const orderId = `mock_order_${randomUUID()}`;
    logger.info('[MOCK] telnyx.orderNumber', { phoneNumber, orderId });
    return { orderId, phoneNumber, status: 'pending' };
  }

  const payload = {
    phone_numbers: [{ phone_number: phoneNumber }],
  };
  if (requirementGroupId) {
    payload.phone_numbers[0].requirement_group_id = requirementGroupId;
  }

  const order = await client().numberOrders.create(payload);
  return {
    orderId: order.data.id,
    phoneNumber,
    status: order.data.status,
  };
}

/**
 * 2. Upload a compliance document (buffer) to the Telnyx Documents API.
 *    Returns the document id.
 */
export async function uploadDocument({ buffer, filename, contentType, customerReference }) {
  if (!telnyxIsLive()) {
    const id = `mock_doc_${randomUUID()}`;
    logger.info('[MOCK] telnyx.uploadDocument', { filename, id });
    return id;
  }

  // The Telnyx SDK accepts a File/Blob for the `file` field.
  const file = new File([buffer], filename, { type: contentType });
  const doc = await client().documents.upload({
    file,
    customer_reference: customerReference,
  });
  return doc.data.id;
}

/**
 * 3. Create a regulatory requirement group and attach the uploaded document IDs.
 *    Returns { requirementGroupId, status }.
 */
export async function createRequirementGroup({ documentIds, phoneNumberType = 'local', countryCode = 'GB', action = 'ordering' }) {
  if (!telnyxIsLive()) {
    const requirementGroupId = `mock_reqgrp_${randomUUID()}`;
    logger.info('[MOCK] telnyx.createRequirementGroup', { requirementGroupId, documentIds });
    return { requirementGroupId, status: 'pending' };
  }

  const group = await client().requirementGroups.create({
    country_code: countryCode,
    phone_number_type: phoneNumberType,
    action,
    // Requirement field values map requirement_type_id -> value (document id).
    regulatory_requirements: documentIds.map((docId) => ({
      requirement_id: docId,
      field_value: docId,
    })),
  });

  return { requirementGroupId: group.data.id, status: group.data.status };
}

/**
 * 4. Assign the purchased number to our LiveKit-facing SIP connection so
 *    inbound PSTN calls are routed over SIP into LiveKit.
 */
export async function assignNumberToConnection({ phoneNumber, connectionId = env.telnyx.sipConnectionId }) {
  if (!telnyxIsLive()) {
    logger.info('[MOCK] telnyx.assignNumberToConnection', { phoneNumber, connectionId });
    return { ok: true, connectionId: connectionId || 'mock_connection' };
  }

  if (!connectionId) {
    const err = new Error('TELNYX_SIP_CONNECTION_ID is not configured');
    err.status = 500;
    throw err;
  }

  // Find the phone number resource id, then update its connection.
  const list = await client().phoneNumbers.list({ filter: { phone_number: phoneNumber } });
  const pn = list?.data?.[0];
  if (!pn) {
    const err = new Error(`Purchased number ${phoneNumber} not found on account yet`);
    err.status = 409;
    throw err;
  }

  await client().phoneNumbers.update(pn.id, { connection_id: connectionId });
  return { ok: true, connectionId };
}

/**
 * Fetch current status of a number order (used by webhook reconciliation).
 */
export async function getNumberOrder(orderId) {
  if (!telnyxIsLive()) {
    return { id: orderId, status: 'success' };
  }
  const res = await client().numberOrders.retrieve(orderId);
  return res.data;
}

import { logger } from '../utils/logger.js';
import * as clientsRepo from '../db/clients.repo.js';
import * as telnyx from './telnyx.service.js';
import * as livekit from './livekit.service.js';
import * as email from './email.service.js';

/**
 * Orchestrates the full onboarding workflow described in the spec:
 *  1. Telnyx: search + order a local UK number
 *  2. Telnyx: upload compliance docs + create requirement group
 *  3. Telnyx: assign number to the LiveKit SIP connection
 *  4. LiveKit: create inbound trunk + dispatch rule -> sitering-receptionist
 *  5. DB: persist client (PENDING_REGULATORY_APPROVAL)
 *  6. Email: send "Onboarding Received" autoresponder
 *
 * Ordering note: we create the DB client row FIRST so we always have a record,
 * then attach provider artefacts as they succeed. This keeps failures debuggable
 * and lets the webhook reconcile later.
 */
export async function runOnboarding({ input, files }) {
  // Step 5 (early): create the client so we have an id for LiveKit metadata.
  const client = await clientsRepo.createClient({
    business_name: input.business_name,
    contact_name: input.contact_name,
    email: input.email,
    phone_number: input.phone_number,
    ai_greeting: input.ai_greeting,
    business_hours: input.business_hours,
    emergency_number: input.emergency_forward_number,
  });
  logger.info('client.created', { clientId: client.id, email: client.email });

  // Step 2: upload compliance documents to Telnyx.
  const documentIds = [];
  if (files?.proof_of_id?.[0]) {
    const f = files.proof_of_id[0];
    documentIds.push(
      await telnyx.uploadDocument({
        buffer: f.buffer,
        filename: f.originalname,
        contentType: f.mimetype,
        customerReference: `${client.id}:proof_of_id`,
      }),
    );
  }
  if (files?.proof_of_address?.[0]) {
    const f = files.proof_of_address[0];
    documentIds.push(
      await telnyx.uploadDocument({
        buffer: f.buffer,
        filename: f.originalname,
        contentType: f.mimetype,
        customerReference: `${client.id}:proof_of_address`,
      }),
    );
  }

  // Step 2b: create a regulatory requirement group linking the documents.
  const { requirementGroupId } = await telnyx.createRequirementGroup({ documentIds });

  // Step 1: search + order the number, linking the requirement group for Ofcom.
  const phoneNumber = await telnyx.searchLocalNumber({ areaCode: input.target_area_code });
  const order = await telnyx.orderNumber({ phoneNumber, requirementGroupId });

  // Step 3: assign the number to our LiveKit-facing SIP connection.
  await telnyx.assignNumberToConnection({ phoneNumber });

  // Step 4: LiveKit inbound trunk + dispatch rule -> sitering-receptionist.
  const { trunkId, dispatchRuleId } = await livekit.provisionInboundRouting({
    phoneNumber,
    businessName: input.business_name,
    clientId: client.id,
  });

  // Persist provider artefacts on the client record.
  const updated = await clientsRepo.updateClientProvisioning(client.id, {
    telnyx_number: phoneNumber,
    telnyx_number_order_id: order.orderId,
    telnyx_requirement_group_id: requirementGroupId,
    livekit_trunk_id: trunkId,
    livekit_dispatch_rule_id: dispatchRuleId,
    status: 'PENDING_REGULATORY_APPROVAL',
  });

  // Step 6: initial onboarding autoresponder.
  await email.sendOnboardingReceived({
    to: client.email,
    businessName: client.business_name,
    telnyxNumber: phoneNumber,
  });

  logger.info('onboarding.complete', { clientId: client.id, phoneNumber });
  return updated;
}

import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { verifyTelnyxSignature } from '../utils/telnyxSignature.js';
import { logger } from '../utils/logger.js';
import { recordEvent } from '../db/events.repo.js';
import * as email from '../services/email.service.js';
import {
  getClientByOrderId,
  getClientByRequirementGroup,
  getClientByTelnyxNumber,
  setClientStatus,
} from '../db/clients.repo.js';

const router = Router();

const APPROVED_STATES = new Set(['approved', 'active', 'success', 'completed']);

/**
 * POST /api/webhooks/telnyx
 * NOTE: this route is mounted with express.raw() so req.body is a Buffer,
 * which is required for signature verification.
 */
router.post(
  '/telnyx',
  asyncHandler(async (req, res) => {
    const signature = req.get('telnyx-signature-ed25519');
    const timestamp = req.get('telnyx-timestamp');
    const rawBody = req.body; // Buffer (see raw parser in index.js)

    if (!verifyTelnyxSignature(rawBody, signature, timestamp)) {
      logger.warn('Rejected Telnyx webhook: invalid signature');
      return res.status(401).json({ error: 'invalid_signature' });
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    const data = event?.data || {};
    const eventType = data.event_type || data.record_type || 'unknown';
    const payload = data.payload || {};

    // Idempotency: skip if we've already processed this exact event id.
    const { inserted } = await recordEvent({
      provider: 'telnyx',
      event_type: eventType,
      external_id: data.id || null,
      payload: event,
    });
    if (!inserted) {
      logger.info('Duplicate Telnyx webhook ignored', { eventType, id: data.id });
      return res.status(200).json({ status: 'duplicate_ignored' });
    }

    logger.info('telnyx.webhook', { eventType });

    // Resolve which client this event concerns.
    let client = null;
    const newStatus = (payload.status || payload.order_status || '').toLowerCase();

    if (eventType.includes('requirement_group')) {
      client = await getClientByRequirementGroup(payload.id || payload.requirement_group_id);
    } else if (eventType.includes('number_order') || eventType.includes('number.order')) {
      client = await getClientByOrderId(payload.id || payload.order_id);
    }

    // Fallback: match by phone number if present.
    if (!client && Array.isArray(payload.phone_numbers) && payload.phone_numbers[0]) {
      const num = payload.phone_numbers[0].phone_number || payload.phone_numbers[0];
      client = await getClientByTelnyxNumber(num);
    }

    if (!client) {
      logger.warn('No client matched for Telnyx event', { eventType });
      return res.status(200).json({ status: 'no_match' });
    }

    if (APPROVED_STATES.has(newStatus)) {
      if (client.status !== 'ACTIVE') {
        const updated = await setClientStatus(client.id, 'ACTIVE');
        await email.sendActivation({
          to: updated.email,
          businessName: updated.business_name,
          telnyxNumber: updated.telnyx_number,
        });
        logger.info('client.activated', { clientId: client.id });
      }
    } else if (['rejected', 'failed', 'declined'].includes(newStatus)) {
      await setClientStatus(client.id, 'REGULATORY_REJECTED');
      logger.warn('client.regulatory_rejected', { clientId: client.id, newStatus });
    }

    return res.status(200).json({ status: 'processed' });
  }),
);

export default router;

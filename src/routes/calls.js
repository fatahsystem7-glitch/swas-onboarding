import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getClientById } from '../db/clients.repo.js';
import { createCall } from '../db/calls.repo.js';
import { storeRecording } from '../services/storage.service.js';
import * as email from '../services/email.service.js';
import { logger } from '../utils/logger.js';
import { requireInternalToken } from '../middleware/internalAuth.js';

const router = Router();

/**
 * POST /api/calls
 * Called by the `sitering-receptionist` worker / LiveKit egress after a call
 * completes. Persists the recording, transcript & AI summary, and fires the
 * lead-alert autoresponder when the call is an actionable lead.
 *
 * Body (application/json):
 *   client_id            (required)
 *   caller_number        (required)
 *   recording_url        (optional — if the worker already stored the file)
 *   recording_base64     (optional — raw mp3 to persist via storage.service)
 *   transcript, summary  (optional)
 *   is_lead              (optional, boolean)
 *   duration_seconds     (optional)
 *
 * Protect this route with a shared secret in production
 * (see INTERNAL_API_TOKEN handling below).
 */
router.post(
  '/calls',
  requireInternalToken,
  asyncHandler(async (req, res) => {
    const {
      client_id,
      caller_number,
      recording_url,
      recording_base64,
      transcript,
      summary,
      is_lead = false,
      duration_seconds,
    } = req.body || {};

    if (!client_id || !caller_number) {
      return res.status(400).json({ error: 'client_id and caller_number are required' });
    }

    const client = await getClientById(client_id);
    if (!client) return res.status(404).json({ error: 'client_not_found' });

    // Persist recording if raw audio was provided instead of a URL.
    let finalUrl = recording_url || null;
    if (!finalUrl && recording_base64) {
      const buffer = Buffer.from(recording_base64, 'base64');
      const key = `${client_id}/${Date.now()}.mp3`;
      finalUrl = await storeRecording({ key, buffer, contentType: 'audio/mpeg' });
    }

    const call = await createCall({
      client_id,
      caller_number,
      recording_url: finalUrl,
      transcript: transcript || null,
      summary: summary || null,
      is_lead: Boolean(is_lead),
      duration_seconds: duration_seconds ? Number(duration_seconds) : null,
    });

    // Fire the lead-alert autoresponder to the contractor.
    if (call.is_lead) {
      await email
        .sendLeadAlert({
          to: client.email,
          businessName: client.business_name,
          callerNumber: caller_number,
          summary,
          recordingUrl: finalUrl,
        })
        .catch((err) => logger.error('lead_alert_failed', { error: err.message }));
    }

    return res.status(201).json({ status: 'ok', call });
  }),
);

export default router;

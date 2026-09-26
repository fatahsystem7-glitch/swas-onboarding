import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getClientById } from '../db/clients.repo.js';
import { listCallsForClient } from '../db/calls.repo.js';

const router = Router();

/**
 * GET /api/clients/:id
 * Returns the client profile (safe fields) for the dashboard.
 */
router.get(
  '/clients/:id',
  asyncHandler(async (req, res) => {
    const client = await getClientById(req.params.id);
    if (!client) return res.status(404).json({ error: 'not_found' });
    return res.json({
      id: client.id,
      business_name: client.business_name,
      contact_name: client.contact_name,
      email: client.email,
      telnyx_number: client.telnyx_number,
      status: client.status,
      ai_greeting: client.ai_greeting,
      business_hours: client.business_hours,
      emergency_number: client.emergency_number,
      created_at: client.created_at,
    });
  }),
);

/**
 * GET /api/clients/:id/calls
 * Powers the dashboard call list: recording playback, transcript & summary.
 */
router.get(
  '/clients/:id/calls',
  asyncHandler(async (req, res) => {
    const client = await getClientById(req.params.id);
    if (!client) return res.status(404).json({ error: 'not_found' });

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const calls = await listCallsForClient(req.params.id, { limit, offset });

    return res.json({ client_id: req.params.id, count: calls.length, calls });
  }),
);

export default router;

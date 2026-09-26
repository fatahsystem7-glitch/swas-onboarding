import { Router } from 'express';
import { uploadOnboardingDocs } from '../middleware/upload.js';
import { onboardSchema, validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getClientByEmail } from '../db/clients.repo.js';
import { runOnboarding } from '../services/onboarding.service.js';

const router = Router();

/**
 * POST /api/onboard
 * multipart/form-data
 *   fields: business_name, contact_name, email, phone_number, target_area_code,
 *           ai_greeting, business_hours, emergency_forward_number
 *   files:  proof_of_id, proof_of_address
 */
router.post(
  '/onboard',
  uploadOnboardingDocs,
  validateBody(onboardSchema),
  asyncHandler(async (req, res) => {
    const input = req.validated;

    // Guard duplicate signups.
    const existing = await getClientByEmail(input.email);
    if (existing) {
      return res.status(409).json({
        error: 'client_exists',
        message: 'A client with this email already exists.',
        client_id: existing.id,
      });
    }

    // Require both compliance documents for Ofcom submission.
    const files = req.files || {};
    if (!files.proof_of_id?.[0] || !files.proof_of_address?.[0]) {
      return res.status(400).json({
        error: 'missing_documents',
        message: 'Both proof_of_id and proof_of_address files are required.',
      });
    }

    const client = await runOnboarding({ input, files });

    return res.status(201).json({
      status: 'ok',
      message: 'Onboarding received. Number reserved; pending regulatory approval.',
      client: {
        id: client.id,
        business_name: client.business_name,
        email: client.email,
        telnyx_number: client.telnyx_number,
        status: client.status,
      },
    });
  }),
);

export default router;

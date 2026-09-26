import { getPool } from './pool.js';
import { createClient, updateClientProvisioning } from './clients.repo.js';
import { createCall } from './calls.repo.js';
import { logger } from '../utils/logger.js';

async function seed() {
  const client = await createClient({
    business_name: 'Bradford Boiler Bros',
    contact_name: 'Dave Sutcliffe',
    email: 'dave@bradfordboilerbros.co.uk',
    phone_number: '+447700900123',
    ai_greeting: 'Thanks for calling Bradford Boiler Bros, how can I help?',
    business_hours: { mon_fri: '08:00-18:00', sat: '09:00-13:00', sun: 'closed' },
    emergency_number: '+447700900999',
  });

  await updateClientProvisioning(client.id, {
    telnyx_number: '+441274123456',
    status: 'ACTIVE',
  });

  await createCall({
    client_id: client.id,
    caller_number: '+447700900555',
    recording_url: 'https://example.com/recordings/demo.mp3',
    transcript: 'Caller: My boiler is leaking... AI: I can book an engineer for tomorrow morning.',
    summary: 'Boiler leak in BD1. Wants next-day engineer visit. Actionable lead.',
    is_lead: true,
    duration_seconds: 142,
  });

  logger.info('seed.complete', { clientId: client.id });
  await getPool().end();
}

seed().catch((err) => {
  logger.error('seed.failed', { error: err.message });
  process.exit(1);
});

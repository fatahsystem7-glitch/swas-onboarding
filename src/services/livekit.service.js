import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let sipClientPromise = null;

async function sipClient() {
  if (sipClientPromise) return sipClientPromise;
  sipClientPromise = (async () => {
    const { SipClient } = await import('livekit-server-sdk');
    return new SipClient(env.livekit.url, env.livekit.apiKey, env.livekit.apiSecret);
  })();
  return sipClientPromise;
}

export function livekitIsLive() {
  return !env.mockProviders && Boolean(env.livekit.apiKey && env.livekit.apiSecret);
}

/**
 * 1. Register the newly purchased number as an inbound SIP trunk.
 *    Returns the trunk id.
 */
export async function createInboundTrunk({ phoneNumber, businessName }) {
  if (!livekitIsLive()) {
    const trunkId = `mock_trunk_${randomUUID()}`;
    logger.info('[MOCK] livekit.createInboundTrunk', { phoneNumber, trunkId });
    return trunkId;
  }

  const client = await sipClient();
  const trunk = await client.createSipInboundTrunk(
    `inbound-${businessName || 'client'}`.slice(0, 60),
    [phoneNumber], // numbers this trunk accepts
    {
      // Accept calls arriving at the LiveKit SIP host for this number.
      metadata: JSON.stringify({ phoneNumber, businessName }),
    },
  );
  return trunk.sipTrunkId;
}

/**
 * 2. Create a dispatch rule that routes calls on this trunk to the
 *    `sitering-receptionist` agent, passing client_id in metadata so the
 *    worker can load per-client prompt settings from PostgreSQL.
 *    Returns the dispatch rule id.
 */
export async function createDispatchRule({ trunkId, clientId }) {
  if (!livekitIsLive()) {
    const ruleId = `mock_rule_${randomUUID()}`;
    logger.info('[MOCK] livekit.createDispatchRule', { trunkId, clientId, ruleId });
    return ruleId;
  }

  const client = await sipClient();
  const rule = await client.createSipDispatchRule(
    {
      // One room per call, prefixed for readability.
      type: 'individual',
      roomPrefix: `call-${clientId}`,
    },
    {
      name: `dispatch-${clientId}`,
      trunkIds: [trunkId],
      // Attach the agent so the receptionist worker is dispatched into the room.
      roomConfig: {
        agents: [
          {
            agentName: env.livekit.agentName,
            metadata: JSON.stringify({ client_id: clientId }),
          },
        ],
      },
      metadata: JSON.stringify({ client_id: clientId }),
    },
  );
  return rule.sipDispatchRuleId;
}

/**
 * Convenience: provision both trunk + dispatch rule for a client.
 */
export async function provisionInboundRouting({ phoneNumber, businessName, clientId }) {
  const trunkId = await createInboundTrunk({ phoneNumber, businessName });
  const dispatchRuleId = await createDispatchRule({ trunkId, clientId });
  return { trunkId, dispatchRuleId };
}

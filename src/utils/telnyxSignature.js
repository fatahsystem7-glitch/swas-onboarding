import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

// DER SPKI prefix for an Ed25519 public key (RFC 8410). Prepending this to the
// 32-byte raw key lets Node's crypto build a usable KeyObject.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function publicKeyObject(base64Key) {
  const raw = Buffer.from(base64Key, 'base64');
  if (raw.length !== 32) {
    throw new Error('TELNYX_PUBLIC_KEY must be a 32-byte base64 Ed25519 key');
  }
  const der = Buffer.concat([ED25519_SPKI_PREFIX, raw]);
  return crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
}

/**
 * Verify a Telnyx webhook.
 * @param {Buffer|string} rawBody - the exact raw request body bytes
 * @param {string} signatureB64 - value of `telnyx-signature-ed25519` header
 * @param {string} timestamp - value of `telnyx-timestamp` header
 * @param {number} toleranceSeconds - reject events older than this
 * @returns {boolean}
 */
export function verifyTelnyxSignature(rawBody, signatureB64, timestamp, toleranceSeconds = 300) {
  if (env.mockProviders && !env.telnyx.publicKey) {
    logger.warn('[MOCK] Skipping Telnyx signature verification (no public key set)');
    return true;
  }
  if (!env.telnyx.publicKey) throw new Error('TELNYX_PUBLIC_KEY is not configured');
  if (!signatureB64 || !timestamp) return false;

  // Replay protection.
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > toleranceSeconds) {
    logger.warn('Telnyx webhook timestamp outside tolerance', { timestamp });
    return false;
  }

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
  const signedPayload = Buffer.concat([Buffer.from(`${timestamp}|`), body]);
  const signature = Buffer.from(signatureB64, 'base64');

  try {
    return crypto.verify(null, signedPayload, publicKeyObject(env.telnyx.publicKey), signature);
  } catch (err) {
    logger.error('Telnyx signature verification error', { error: err.message });
    return false;
  }
}

import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export function s3IsLive() {
  return !env.mockProviders && Boolean(env.storage.s3Bucket && env.storage.awsAccessKeyId);
}

/**
 * Persist a call recording. Uses S3 when configured, otherwise falls back to a
 * local directory (suitable for a Railway volume mount).
 * Returns a publicly referenceable URL/path stored on the call record.
 */
export async function storeRecording({ key, buffer, contentType = 'audio/mpeg' }) {
  if (s3IsLive()) {
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const s3 = new S3Client({
      region: env.storage.awsRegion,
      credentials: {
        accessKeyId: env.storage.awsAccessKeyId,
        secretAccessKey: env.storage.awsSecretAccessKey,
      },
    });
    await s3.send(
      new PutObjectCommand({
        Bucket: env.storage.s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
    const url = `https://${env.storage.s3Bucket}.s3.${env.storage.awsRegion}.amazonaws.com/${key}`;
    logger.info('storage.storeRecording → s3', { key });
    return url;
  }

  // Local / Railway-volume fallback.
  const dir = resolve(env.storage.localDir);
  await mkdir(dir, { recursive: true });
  const safeName = key.replace(/[^a-zA-Z0-9._-]/g, '_');
  const filePath = join(dir, safeName);
  await writeFile(filePath, buffer);
  logger.info('storage.storeRecording → local', { filePath });
  // Served by the app at /recordings/:file (see index.js static mount).
  return `${env.publicBaseUrl}/recordings/${safeName}`;
}

import dotenv from 'dotenv';

dotenv.config();

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,

  // When true, providers are stubbed so the app boots without live credentials.
  // Also auto-enabled per-provider when a given provider's credentials are missing.
  mockProviders: bool(process.env.MOCK_PROVIDERS, true),

  telnyx: {
    apiKey: process.env.TELNYX_API_KEY || '',
    publicKey: process.env.TELNYX_PUBLIC_KEY || '',
    sipConnectionId: process.env.TELNYX_SIP_CONNECTION_ID || '',
  },

  livekit: {
    url: process.env.LIVEKIT_URL || 'https://1t7smtelwif.sip.livekit.cloud',
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
    agentName: process.env.LIVEKIT_AGENT_NAME || 'sitering-receptionist',
  },

  email: {
    resendApiKey: process.env.RESEND_API_KEY || '',
    from: process.env.EMAIL_FROM || 'SiteRing <onboarding@example.com>',
  },

  storage: {
    s3Bucket: process.env.S3_BUCKET_NAME || '',
    awsRegion: process.env.AWS_REGION || 'eu-west-2',
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    localDir: process.env.LOCAL_STORAGE_DIR || './storage/recordings',
  },

  databaseUrl: process.env.DATABASE_URL || '',
};

export function isProd() {
  return env.nodeEnv === 'production';
}

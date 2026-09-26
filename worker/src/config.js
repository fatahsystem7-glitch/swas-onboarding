import dotenv from 'dotenv';
dotenv.config();

export const config = {
  livekitUrl: process.env.LIVEKIT_URL || '',
  livekitApiKey: process.env.LIVEKIT_API_KEY || '',
  livekitApiSecret: process.env.LIVEKIT_API_SECRET || '',
  agentName: process.env.AGENT_NAME || 'sitering-receptionist',

  deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',

  databaseUrl: process.env.DATABASE_URL || '',

  apiBaseUrl: process.env.SWAS_API_BASE_URL || 'http://localhost:3000',
  internalApiToken: process.env.INTERNAL_API_TOKEN || '',
};

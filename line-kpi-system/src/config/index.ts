import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  port: parseInt(optional('PORT', '3000'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),

  mongoUri: required('MONGODB_URI'),

  apiKey: required('API_KEY'),

  conversationGapHours: parseInt(optional('CONVERSATION_GAP_HOURS', '4'), 10),

  aiProvider: optional('AI_PROVIDER', 'openrouter') as 'openrouter' | 'kilo',

  openrouter: {
    apiKey: optional('OPENROUTER_API_KEY', ''),
    model: optional('OPENROUTER_MODEL', 'mistralai/mistral-7b-instruct:free'),
    baseUrl: optional('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1'),
  },

  kilo: {
    apiKey: optional('KILO_API_KEY', ''),
    model: optional('KILO_MODEL', ''),
    baseUrl: optional('KILO_BASE_URL', ''),
  },

  cron: {
    dailyEvaluation: optional('CRON_DAILY_EVALUATION', '0 23 * * *'),
    issueAnalysis: optional('CRON_ISSUE_ANALYSIS', '30 23 * * *'),
  },

  evaluatePreviousDay: optional('EVALUATE_PREVIOUS_DAY', 'true') === 'true',
} as const;

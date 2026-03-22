import { Schema, model } from 'mongoose';
import { config } from '../config';

export interface ISystemConfig {
  _id: string;
  jobs: {
    dailyEvaluation: { enabled: boolean };
    issueAnalysis: { enabled: boolean };
  };
  ai: {
    provider: 'openrouter' | 'kilo';
    openrouter: { apiKey: string; model: string; baseUrl: string };
    kilo: { apiKey: string; model: string; baseUrl: string };
  };
  updatedAt: Date;
}

const systemConfigSchema = new Schema<ISystemConfig>(
  {
    _id: { type: String, default: 'singleton' },
    jobs: {
      dailyEvaluation: { enabled: { type: Boolean, default: true } },
      issueAnalysis: { enabled: { type: Boolean, default: true } },
    },
    ai: {
      provider: {
        type: String,
        enum: ['openrouter', 'kilo'],
        default: config.aiProvider,
      },
      openrouter: {
        apiKey: { type: String, default: config.openrouter.apiKey },
        model: { type: String, default: config.openrouter.model },
        baseUrl: { type: String, default: config.openrouter.baseUrl },
      },
      kilo: {
        apiKey: { type: String, default: config.kilo.apiKey },
        model: { type: String, default: config.kilo.model },
        baseUrl: { type: String, default: config.kilo.baseUrl },
      },
    },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { _id: false, timestamps: false }
);

export const SystemConfig = model<ISystemConfig>('SystemConfig', systemConfigSchema);

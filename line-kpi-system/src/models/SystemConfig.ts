import { Schema, model } from 'mongoose';

// ---- New interfaces ----

export interface IAiProviderInGroup {
  providerKey: string;  // e.g. 'openrouter', 'anthropic'
  apiKey: string;       // masked on GET responses
  baseUrl: string;      // '' = use KNOWN_PROVIDERS default
  models: string[];     // ordered priority — try [0] first
  enabled: boolean;
}

export interface IAiProviderGroup {
  name: string;                     // user-defined display name
  providers: IAiProviderInGroup[];  // ordered by priority (failover order)
}

export type AiTaskName = 'issueAnalysis';

export interface ISystemConfig {
  _id: string;
  jobs: {
    dailyAnalysis: { enabled: boolean };
  };
  ai: {
    // After toObject({ flattenMaps: true }) this becomes a plain Record
    providerGroups: Record<string, IAiProviderGroup>;
    tasks: Record<AiTaskName, { groupId: string }>;
  };
  updatedAt: Date;
}

// ---- Mongoose sub-schemas ----

const providerInGroupSchema = new Schema<IAiProviderInGroup>(
  {
    providerKey: { type: String, required: true },
    apiKey:      { type: String, default: '' },
    baseUrl:     { type: String, default: '' },
    models:      { type: [String], default: [] },
    enabled:     { type: Boolean, default: true },
  },
  { _id: false }
);

const providerGroupSchema = new Schema<IAiProviderGroup>(
  {
    name:      { type: String, required: true },
    providers: { type: [providerInGroupSchema], default: [] },
  },
  { _id: false }
);

const systemConfigSchema = new Schema<ISystemConfig>(
  {
    _id: { type: String, default: 'singleton' },
    jobs: {
      dailyAnalysis: { enabled: { type: Boolean, default: true } },
    },
    ai: {
      providerGroups: {
        type: Map,
        of: providerGroupSchema,
        default: () => ({
          grp_default: {
            name: 'Default Group',
            providers: [],
          },
        }),
      },
      tasks: {
        issueAnalysis: { groupId: { type: String, default: 'grp_default' } },
      },
    },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { _id: false, timestamps: false }
);

export const SystemConfig = model<ISystemConfig>('SystemConfig', systemConfigSchema);

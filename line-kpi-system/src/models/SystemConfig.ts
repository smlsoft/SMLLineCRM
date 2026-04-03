import { Schema, model } from 'mongoose';

// ---- Media Storage interfaces ----

export interface IMediaR2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export interface IMediaS3Config {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export interface IMediaStorageConfig {
  storage: 'none' | 'r2' | 's3';
  r2: IMediaR2Config;
  s3: IMediaS3Config;
}

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
  media: IMediaStorageConfig;
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

const mediaR2Schema = new Schema<IMediaR2Config>(
  {
    accountId:       { type: String, default: '' },
    accessKeyId:     { type: String, default: '' },
    secretAccessKey: { type: String, default: '' },
    bucketName:      { type: String, default: '' },
    publicUrl:       { type: String, default: '' },
  },
  { _id: false }
);

const mediaS3Schema = new Schema<IMediaS3Config>(
  {
    region:          { type: String, default: '' },
    accessKeyId:     { type: String, default: '' },
    secretAccessKey: { type: String, default: '' },
    bucketName:      { type: String, default: '' },
    publicUrl:       { type: String, default: '' },
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
    media: {
      storage: { type: String, enum: ['none', 'r2', 's3'], default: 'none' },
      r2: { type: mediaR2Schema, default: () => ({}) },
      s3: { type: mediaS3Schema, default: () => ({}) },
    },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { _id: false, timestamps: false }
);

export const SystemConfig = model<ISystemConfig>('SystemConfig', systemConfigSchema);

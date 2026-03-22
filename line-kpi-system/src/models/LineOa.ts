import { Schema, model, Document } from 'mongoose';

export interface ILineOa extends Document {
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
  displayName: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const lineOaSchema = new Schema<ILineOa>(
  {
    channelId: { type: String, required: true, unique: true, index: true },
    channelSecret: { type: String, required: true },
    channelAccessToken: { type: String, required: true },
    displayName: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const LineOa = model<ILineOa>('LineOa', lineOaSchema);

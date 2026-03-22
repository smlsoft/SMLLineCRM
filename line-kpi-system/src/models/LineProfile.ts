import { Schema, model, Document } from 'mongoose';

export interface ILineProfile extends Document {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  refreshedAt: Date;
}

const lineProfileSchema = new Schema<ILineProfile>(
  {
    lineUserId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, required: true },
    pictureUrl: { type: String },
    refreshedAt: { type: Date, required: true },
  },
  { _id: true, timestamps: false }
);

export const LineProfile = model<ILineProfile>('LineProfile', lineProfileSchema);

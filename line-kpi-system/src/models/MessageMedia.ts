import { Schema, model, Document, Types } from 'mongoose';

export interface IMessageMedia extends Document {
  messageId: Types.ObjectId;   // ref: 'Message'
  lineMessageId: string;        // สำหรับ dedup / debug
  mimeType: string;             // 'image/jpeg' | 'image/png' | ...
  data: string;                 // base64-encoded binary
  sizeBytes: number;
  fetchedAt: Date;
}

const messageMediaSchema = new Schema<IMessageMedia>(
  {
    messageId:     { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    lineMessageId: { type: String, required: true },
    mimeType:      { type: String, required: true },
    data:          { type: String, required: true },
    sizeBytes:     { type: Number, required: true },
    fetchedAt:     { type: Date, required: true },
  },
  { _id: true, timestamps: false }
);

// idempotent — LINE retry จะ throw 11000 แทนที่จะสร้าง doc ซ้ำ
messageMediaSchema.index({ messageId: 1 }, { unique: true });
messageMediaSchema.index({ lineMessageId: 1 }, { unique: true });

export const MessageMedia = model<IMessageMedia>('MessageMedia', messageMediaSchema);

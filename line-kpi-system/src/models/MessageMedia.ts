import { Schema, model, Document, Types } from 'mongoose';

export interface IMessageMedia extends Document {
  messageId: Types.ObjectId;   // ref: 'Message'
  lineMessageId: string;        // สำหรับ dedup / debug
  mimeType: string;             // 'image/jpeg' | 'image/png' | ...
  storage?: 'r2' | 's3' | 'minio' | 'mongodb';
  objectKey?: string;           // object key ใน cloud storage (R2/S3/MinIO)
  data?: string;                // base64-encoded binary (เมื่อเก็บใน MongoDB)
  url?: string;                 // URL ของรูป (public URL หรือ /api/proxy/media/:id)
  sizeBytes: number;
  fetchedAt: Date;
}

const messageMediaSchema = new Schema<IMessageMedia>(
  {
    messageId:     { type: Schema.Types.ObjectId, ref: 'Message', required: true },
    lineMessageId: { type: String, required: true },
    mimeType:      { type: String, required: true },
    storage:       { type: String, enum: ['r2', 's3', 'minio', 'mongodb'] },
    objectKey:     { type: String },
    data:          { type: String },
    url:           { type: String },
    sizeBytes:     { type: Number, required: true },
    fetchedAt:     { type: Date, required: true },
  },
  { _id: true, timestamps: false }
);

// idempotent — LINE retry จะ throw 11000 แทนที่จะสร้าง doc ซ้ำ
messageMediaSchema.index({ messageId: 1 }, { unique: true });
messageMediaSchema.index({ lineMessageId: 1 }, { unique: true });
messageMediaSchema.index({ fetchedAt: 1 });

export const MessageMedia = model<IMessageMedia>('MessageMedia', messageMediaSchema);

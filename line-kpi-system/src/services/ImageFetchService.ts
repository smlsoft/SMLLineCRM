import { Readable } from 'stream';
import { messagingApi } from '@line/bot-sdk';
import { Types } from 'mongoose';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { MessageMedia } from '../models/MessageMedia';
import { Message } from '../models/Message';
import { configService } from './ConfigService';

/**
 * ดึงรูปภาพจาก LINE Content API → แปลงเป็น base64 → บันทึกใน MessageMedia collection
 * แล้วเขียน mediaId กลับไปใน Message document
 *
 * Best-effort: ถ้า error ใดๆ เกิดขึ้น จะ log warning แล้วจบ ไม่ throw
 */
export async function fetchAndStoreImage(params: {
  messageDocId: Types.ObjectId;
  lineMessageId: string;
  oaAccessToken: string;
}): Promise<void> {
  const { messageDocId, lineMessageId, oaAccessToken } = params;

  try {
    // 0. ตรวจ config ว่าจะเก็บรูปที่ไหน
    const cfg = await configService.getConfig();
    const { storage } = cfg.media;

    if (storage === 'none') {
      // ไม่เก็บรูปเลย — ข้ามได้เลย
      return;
    }

    // 1. สร้าง BlobClient สำหรับดึง binary content
    const blobClient = new messagingApi.MessagingApiBlobClient({
      channelAccessToken: oaAccessToken,
    });

    // 2. ดึง content stream จาก LINE
    const stream = await blobClient.getMessageContent(lineMessageId) as unknown as Readable;

    // 3. Buffer stream ทั้งหมด
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', resolve);
      stream.on('error', reject);
    });
    const buffer = Buffer.concat(chunks);
    const sizeBytes = buffer.byteLength;

    // 4. ตรวจ MIME type จาก magic bytes
    const mimeType = detectMimeType(buffer);
    const ext = mimeType.split('/')[1] ?? 'bin';
    const objectKey = `media/${lineMessageId}.${ext}`;

    let mediaDocData: { data?: string; url?: string };

    if (storage === 'r2' || storage === 's3') {
      // 5. Upload ไป cloud storage
      const url = await uploadToCloud({ buffer, objectKey, mimeType, storage, cfg });
      mediaDocData = { url };
    } else {
      // fallback — เก็บ base64 ใน MongoDB (ไม่ควรถึงตรงนี้ แต่ type-safe)
      mediaDocData = { data: buffer.toString('base64') };
    }

    // 6. บันทึก MessageMedia (idempotent — unique index บน lineMessageId)
    let mediaDoc: { _id: Types.ObjectId };
    try {
      mediaDoc = await MessageMedia.create({
        messageId: messageDocId,
        lineMessageId,
        mimeType,
        ...mediaDocData,
        sizeBytes,
        fetchedAt: new Date(),
      });
    } catch (createErr: unknown) {
      if (isMongoUniqueError(createErr)) {
        // LINE retry ส่งซ้ำ — ดึง doc ที่มีอยู่แล้ว
        const existing = await MessageMedia.findOne({ lineMessageId }).select('_id').lean();
        if (!existing) return;
        mediaDoc = existing as { _id: Types.ObjectId };
      } else {
        throw createErr;
      }
    }

    // 7. เขียน mediaId กลับไปใน Message
    await Message.updateOne(
      { _id: messageDocId },
      { $set: { mediaId: mediaDoc._id } }
    );

    console.info(
      `[ImageFetchService] Stored media for message ${lineMessageId} (${sizeBytes} bytes, ${mimeType}, storage=${storage})`
    );
  } catch (err) {
    // ไม่ throw — message ถูก save แล้ว image เป็น best-effort
    console.warn(`[ImageFetchService] Failed to fetch/store image for ${lineMessageId}:`, err);
  }
}

async function uploadToCloud(opts: {
  buffer: Buffer;
  objectKey: string;
  mimeType: string;
  storage: 'r2' | 's3';
  cfg: Awaited<ReturnType<typeof configService.getConfig>>;
}): Promise<string> {
  const { buffer, objectKey, mimeType, storage, cfg } = opts;

  let client: S3Client;
  let bucketName: string;
  let publicUrl: string;

  if (storage === 'r2') {
    const { accountId, accessKeyId, secretAccessKey, bucketName: bn, publicUrl: pu } = cfg.media.r2;
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
    bucketName = bn;
    publicUrl = pu;
  } else {
    const { region, accessKeyId, secretAccessKey, bucketName: bn, publicUrl: pu } = cfg.media.s3;
    client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
    bucketName = bn;
    publicUrl = pu;
  }

  await client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: objectKey,
    Body: buffer,
    ContentType: mimeType,
  }));

  // publicUrl ควรไม่มี trailing slash
  const base = publicUrl.replace(/\/$/, '');
  return `${base}/${objectKey}`;
}

function detectMimeType(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'GIF8') return 'image/gif';
  if (buf.length >= 4 && buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46)
    return 'image/webp';
  return 'application/octet-stream';
}

function isMongoUniqueError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: number }).code === 11000
  );
}

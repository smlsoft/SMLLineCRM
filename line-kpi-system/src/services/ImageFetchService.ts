import { Readable } from 'stream';
import { messagingApi } from '@line/bot-sdk';
import { Types } from 'mongoose';
import { MessageMedia } from '../models/MessageMedia';
import { Message } from '../models/Message';

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

    // 4. แปลงเป็น base64
    const base64Data = buffer.toString('base64');
    const sizeBytes = buffer.byteLength;

    // 5. ตรวจ MIME type จาก magic bytes (ไม่ต้อง request เพิ่ม)
    const mimeType = detectMimeType(buffer);

    // 6. บันทึก MessageMedia (idempotent — unique index บน lineMessageId)
    let mediaDoc: { _id: Types.ObjectId };
    try {
      mediaDoc = await MessageMedia.create({
        messageId: messageDocId,
        lineMessageId,
        mimeType,
        data: base64Data,
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
      `[ImageFetchService] Stored media for message ${lineMessageId} (${sizeBytes} bytes, ${mimeType})`
    );
  } catch (err) {
    // ไม่ throw — message ถูก save แล้ว image เป็น best-effort
    console.warn(`[ImageFetchService] Failed to fetch/store image for ${lineMessageId}:`, err);
  }
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

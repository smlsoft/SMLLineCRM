import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Types } from 'mongoose';
import { Message } from '../models/Message';
import { MessageMedia } from '../models/MessageMedia';
import { configService } from '../services/ConfigService';
import {
  createMediaS3Client,
  type CloudMediaStorage,
  type MediaS3Connection,
} from '../services/MediaStorageClient';

const BATCH_SIZE = 200;

export interface MediaCleanupResult {
  deletedCount: number;
  failedObjectDeletes: number;
  retentionDays: number;
  skipped?: string;
}

function isNotFoundS3Error(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e.name === 'NoSuchKey' ||
    e.Code === 'NoSuchKey' ||
    e.$metadata?.httpStatusCode === 404
  );
}

/**
 * Deletes stored media (cloud object + MessageMedia doc + Message.mediaId ref)
 * older than cfg.media.retentionDays. Set retentionDays = 0 to disable.
 */
export class MediaCleanupJob {
  async run(): Promise<MediaCleanupResult> {
    const cfg = await configService.getConfig();
    const retentionDays = cfg.media?.retentionDays ?? 7;

    if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
      return {
        deletedCount: 0,
        failedObjectDeletes: 0,
        retentionDays,
        skipped: 'retentionDays <= 0',
      };
    }

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    const clientCache = new Map<CloudMediaStorage, MediaS3Connection>();
    const failedClientStorages = new Set<CloudMediaStorage>();
    const failedIds: Types.ObjectId[] = [];

    let deletedCount = 0;
    let failedObjectDeletes = 0;

    while (true) {
      const query: Record<string, unknown> = { fetchedAt: { $lt: cutoff } };
      if (failedIds.length > 0) {
        query._id = { $nin: failedIds };
      }
      if (failedClientStorages.size > 0) {
        query.storage = { $nin: Array.from(failedClientStorages) };
      }

      const batch = await MessageMedia.find(query)
        .select('_id messageId storage objectKey')
        .limit(BATCH_SIZE)
        .lean();

      if (batch.length === 0) break;

      const okMediaIds: Types.ObjectId[] = [];
      const okMessageIds: Types.ObjectId[] = [];

      for (const doc of batch) {
        const storage = doc.storage;
        const isCloud = storage === 'r2' || storage === 's3' || storage === 'minio';

        if (isCloud && doc.objectKey) {
          if (failedClientStorages.has(storage)) {
            failedObjectDeletes++;
            failedIds.push(doc._id as Types.ObjectId);
            continue;
          }

          let conn = clientCache.get(storage);
          if (!conn) {
            try {
              conn = createMediaS3Client(storage, cfg);
              clientCache.set(storage, conn);
            } catch (clientErr) {
              console.warn(`[MediaCleanupJob] Cannot init ${storage} client:`, clientErr);
              failedClientStorages.add(storage);
              failedObjectDeletes++;
              failedIds.push(doc._id as Types.ObjectId);
              continue;
            }
          }

          try {
            await conn.client.send(
              new DeleteObjectCommand({ Bucket: conn.bucketName, Key: doc.objectKey })
            );
          } catch (delErr: unknown) {
            if (!isNotFoundS3Error(delErr)) {
              console.warn(
                `[MediaCleanupJob] Failed to delete ${storage} object ${doc.objectKey}:`,
                delErr
              );
              failedObjectDeletes++;
              failedIds.push(doc._id as Types.ObjectId);
              continue;
            }
          }
        }

        okMediaIds.push(doc._id as Types.ObjectId);
        okMessageIds.push(doc.messageId as Types.ObjectId);
      }

      if (okMediaIds.length > 0) {
        await Message.updateMany(
          { _id: { $in: okMessageIds } },
          { $unset: { mediaId: '' } }
        );
        const delRes = await MessageMedia.deleteMany({ _id: { $in: okMediaIds } });
        deletedCount += delRes.deletedCount ?? okMediaIds.length;
      }

      if (batch.length < BATCH_SIZE) break;
    }

    console.info(
      `[MediaCleanupJob] Completed (retentionDays=${retentionDays}): deleted=${deletedCount}, failedObjectDeletes=${failedObjectDeletes}`
    );

    return { deletedCount, failedObjectDeletes, retentionDays };
  }
}

import { Readable } from 'stream';
import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { MessageMedia } from '../../models/MessageMedia';
import { configService } from '../../services/ConfigService';
import { createMediaS3Client } from '../../services/MediaStorageClient';

const router = Router();

function isNotFoundS3Error(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } };
  return (
    e.name === 'NoSuchKey' ||
    e.Code === 'NoSuchKey' ||
    e.$metadata?.httpStatusCode === 404
  );
}

// GET /api/v1/media/:id
// Serves stored media from MongoDB base64 or private cloud storage (R2/S3/MinIO).
router.get('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid media id' });
    return;
  }

  const media = await MessageMedia.findById(id).lean();
  if (!media) {
    res.status(404).json({ error: 'Media not found' });
    return;
  }

  const contentType = media.mimeType || 'application/octet-stream';

  if (media.data) {
    const buf = Buffer.from(media.data, 'base64');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(buf);
    return;
  }

  if (
    media.objectKey &&
    (media.storage === 'r2' || media.storage === 's3' || media.storage === 'minio')
  ) {
    try {
      const cfg = await configService.getConfig();
      const { client, bucketName } = createMediaS3Client(media.storage, cfg);
      const result = await client.send(
        new GetObjectCommand({ Bucket: bucketName, Key: media.objectKey })
      );

      if (!result.Body) {
        res.status(404).json({ error: 'Media object empty' });
        return;
      }

      res.setHeader('Content-Type', result.ContentType || contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (typeof result.ContentLength === 'number') {
        res.setHeader('Content-Length', String(result.ContentLength));
      }

      const bodyStream = result.Body as unknown as Readable;
      res.on('close', () => {
        if (!res.writableEnded) {
          bodyStream.destroy();
        }
      });
      bodyStream.on('error', (streamErr) => {
        console.warn(`[mediaRoutes] Stream error for ${id}:`, streamErr);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Failed to stream media object' });
        } else {
          res.end();
        }
      });
      bodyStream.pipe(res);
      return;
    } catch (err: unknown) {
      if (isNotFoundS3Error(err)) {
        res.status(404).json({ error: 'Media object not found in storage' });
        return;
      }
      console.error(`[mediaRoutes] Failed to fetch object for ${id}:`, err);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Failed to load media from storage' });
      }
      return;
    }
  }

  res.status(404).json({ error: 'Media payload not available' });
});

export { router as mediaRoutes };

import { S3Client } from '@aws-sdk/client-s3';
import type { ISystemConfig } from '../models/SystemConfig';

export type CloudMediaStorage = 'r2' | 's3' | 'minio';

export interface MediaS3Connection {
  client: S3Client;
  bucketName: string;
  publicUrl: string;
}

/**
 * Create an S3-compatible client for R2, AWS S3, or MinIO from SystemConfig.
 */
export function createMediaS3Client(
  storage: CloudMediaStorage,
  cfg: ISystemConfig
): MediaS3Connection {
  if (storage === 'r2') {
    const { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl } = cfg.media?.r2 ?? {};
    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('R2 credentials incomplete');
    }
    return {
      client: new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      }),
      bucketName,
      publicUrl: publicUrl ?? '',
    };
  }

  if (storage === 's3') {
    const { region, accessKeyId, secretAccessKey, bucketName, publicUrl } = cfg.media?.s3 ?? {};
    if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
      throw new Error('S3 credentials incomplete');
    }
    return {
      client: new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
      }),
      bucketName,
      publicUrl: publicUrl ?? '',
    };
  }

  const { endpoint, accessKeyId, secretAccessKey, bucketName, publicUrl } = cfg.media?.minio ?? {};
  const normalizedEndpoint = (endpoint ?? '').trim().replace(/\/$/, '');
  if (!normalizedEndpoint || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error('MinIO credentials incomplete');
  }
  return {
    client: new S3Client({
      region: 'us-east-1',
      endpoint: normalizedEndpoint,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucketName,
    publicUrl: publicUrl ?? '',
  };
}

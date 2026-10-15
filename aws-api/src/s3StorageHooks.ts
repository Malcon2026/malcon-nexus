import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env, StorageBucketKey } from '../../worker/src/env.ts';

const BUCKET_ENV: Record<StorageBucketKey, keyof Env> = {
  'stage-photos': 'S3_BUCKET_STAGE_PHOTOS',
  'attendance-selfies': 'S3_BUCKET_ATTENDANCE_SELFIES',
  'hr-kyc-uploads': 'S3_BUCKET_HR_KYC_UPLOADS',
};

function bucketName(env: Env, bucket: StorageBucketKey): string {
  const name = (env[BUCKET_ENV[bucket]] as string | undefined)?.trim();
  if (!name) throw new Error(`S3 bucket not configured for ${bucket}`);
  return name;
}

export function createS3StorageHooks(env: Env) {
  const region = env.AWS_REGION || process.env.AWS_REGION || 'ap-south-1';
  const client = new S3Client({ region });

  return {
    async putObject(bucket: StorageBucketKey, key: string, body: ArrayBuffer, contentType: string) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucketName(env, bucket),
          Key: key,
          Body: Buffer.from(body),
          ContentType: contentType,
        }),
      );
    },
    async deleteObjects(bucket: StorageBucketKey, keys: string[]) {
      if (keys.length === 0) return;
      await client.send(
        new DeleteObjectsCommand({
          Bucket: bucketName(env, bucket),
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    },
    publicUrlForKey(_bucket: StorageBucketKey, key: string) {
      const base = env.S3_PUBLIC_BASE_URL?.replace(/\/+$/, '');
      if (!base) return null;
      return `${base}/${encodeURIComponent(key)}`;
    },
    async signedGetUrlForKey(bucket: StorageBucketKey, key: string, expiresInSeconds: number) {
      return getSignedUrl(
        client,
        new GetObjectCommand({ Bucket: bucketName(env, bucket), Key: key }),
        { expiresIn: expiresInSeconds },
      );
    },
  };
}

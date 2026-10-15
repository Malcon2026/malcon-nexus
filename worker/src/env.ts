export type StorageBucketKey = 'stage-photos' | 'attendance-selfies' | 'hr-kyc-uploads';

/** Optional object storage implementation (AWS S3 on Node). */
export type StorageHooks = {
  putObject: (bucket: StorageBucketKey, key: string, body: ArrayBuffer, contentType: string) => Promise<void>;
  deleteObjects: (bucket: StorageBucketKey, keys: string[]) => Promise<void>;
  publicUrlForKey: (bucket: StorageBucketKey, key: string) => string | null;
  signedGetUrlForKey?: (bucket: StorageBucketKey, key: string, expiresInSeconds: number) => Promise<string | null>;
};

/**
 * Worker bindings — populated by Wrangler at runtime.
 * Do not hardcode secrets; use wrangler secrets + dashboard config.
 */
export interface Env {
  ENVIRONMENT: 'development' | 'staging' | 'production';
  API_CORS_ORIGIN: string;
  /** Cloudflare D1 (Worker). Omit on AWS when `pgPool` is set. */
  DB?: D1Database;
  /** Node.js pg pool — AWS RDS PostgreSQL. */
  pgPool?: import('pg').Pool;
  /** Set to "1" in local tests to require Authorization on /api/* */
  API_REQUIRE_AUTH?: string;
  /** Supabase project JWT secret (Settings → API → JWT Secret). Alias: JWT_SECRET. */
  SUPABASE_JWT_SECRET?: string;
  JWT_SECRET?: string;
  /** Expected JWT `aud` (Supabase default: authenticated). */
  SUPABASE_JWT_AUD?: string;
  STAGE_PHOTOS?: R2Bucket;
  ATTENDANCE_SELFIES?: R2Bucket;
  HR_KYC_UPLOADS?: R2Bucket;
  /** Public base URL for R2 objects when served via custom domain (future). */
  R2_PUBLIC_BASE_URL?: string;
  /** AWS S3 bucket names (malconnexus stage photos, selfies, HR KYC). */
  S3_BUCKET_STAGE_PHOTOS?: string;
  S3_BUCKET_ATTENDANCE_SELFIES?: string;
  S3_BUCKET_HR_KYC_UPLOADS?: string;
  S3_PUBLIC_BASE_URL?: string;
  AWS_REGION?: string;
  /** Injected by AWS Node server for S3 upload/delete/signed URLs. */
  storageHooks?: StorageHooks;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  /** Pepper for login OTP hashing (falls back to JWT secret). */
  LOGIN_OTP_SECRET?: string;
}

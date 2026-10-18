/**
 * Worker bindings — populated by Wrangler at runtime.
 * Do not hardcode secrets; use wrangler secrets + dashboard config.
 */
export interface Env {
  ENVIRONMENT: 'development' | 'staging' | 'production';
  API_CORS_ORIGIN: string;
  /** Cloudflare D1 (Worker runtime). */
  DB?: D1Database;
  /** AWS / Node — PostgreSQL connection string. */
  DATABASE_URL?: string;
  PGSSL?: string;
  PG_POOL_MAX?: string;
  /** Set to "1" in local tests to require Authorization on /api/* */
  API_REQUIRE_AUTH?: string;
  /** Supabase project JWT secret (Settings → API → JWT Secret). Alias: JWT_SECRET. */
  SUPABASE_JWT_SECRET?: string;
  JWT_SECRET?: string;
  /** Previous JWT signing secret(s) during rotation (comma-separated allowed). */
  JWT_SECRET_PREVIOUS?: string;
  /** Expected JWT `aud` (Supabase default: authenticated). */
  SUPABASE_JWT_AUD?: string;
  STAGE_PHOTOS?: R2Bucket;
  ATTENDANCE_SELFIES?: R2Bucket;
  HR_KYC_UPLOADS?: R2Bucket;
  /** S3 bucket names (Node/AWS runtime). */
  S3_BUCKET_STAGE_PHOTOS?: string;
  S3_BUCKET_ATTENDANCE_SELFIES?: string;
  S3_BUCKET_HR_KYC_UPLOADS?: string;
  AWS_REGION?: string;
  /** Optional CloudFront or public asset base (no trailing slash). */
  S3_PUBLIC_BASE_URL?: string;
  /** Signed URL TTL seconds for private objects. */
  S3_SIGNED_URL_TTL?: string;
  /** Public base URL for R2 objects when served via custom domain (future). */
  R2_PUBLIC_BASE_URL?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  /** Secures POST /api/case-alerts/process (EventBridge / cron). */
  ALERT_CRON_SECRET?: string;
  /** Pepper for login OTP hashing (falls back to JWT secret). */
  LOGIN_OTP_SECRET?: string;
  /** Shared secret for public gallery album URLs (?token=). */
  GALLERY_TOKEN?: string;
  /** Shared secret for TV kiosk JSON feed (?token=&mode=tv). */
  TV_BOARD_TOKEN?: string;
}

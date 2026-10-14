/**
 * Worker bindings — populated by Wrangler at runtime.
 * Do not hardcode secrets; use wrangler secrets + dashboard config.
 */
export interface Env {
  ENVIRONMENT: 'development' | 'staging' | 'production';
  API_CORS_ORIGIN: string;
  DB: D1Database;
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
  TELEGRAM_BOT_TOKEN?: string;
  /** Pepper for login OTP hashing (falls back to JWT secret). */
  LOGIN_OTP_SECRET?: string;
}

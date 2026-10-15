import pg from 'pg';
import type { Env } from '../../worker/src/env.ts';
import { loadJsonSecret } from './loadSecrets.ts';
import { createS3StorageHooks } from './s3StorageHooks.ts';

const { Pool } = pg;

type MalconApiSecret = {
  DATABASE_URL?: string;
  JWT_SECRET?: string;
  SUPABASE_JWT_SECRET?: string;
  LOGIN_OTP_SECRET?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  S3_BUCKET_STAGE_PHOTOS?: string;
  S3_BUCKET_ATTENDANCE_SELFIES?: string;
  S3_BUCKET_HR_KYC_UPLOADS?: string;
  S3_PUBLIC_BASE_URL?: string;
};

let pool: pg.Pool | undefined;

export async function buildAwsEnv(): Promise<Env> {
  const secretId = process.env.MALCON_API_SECRET_ARN || process.env.AWS_SECRETS_MANAGER_SECRET_ID;
  const fromSecret = await loadJsonSecret<MalconApiSecret>(secretId);

  const databaseUrl =
    process.env.DATABASE_URL?.trim() ||
    fromSecret.DATABASE_URL?.trim() ||
    process.env.RDS_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error('DATABASE_URL (or MALCON_API_SECRET_ARN with DATABASE_URL) is required');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.PGSSL === '0' ? undefined : { rejectUnauthorized: false },
      max: Number(process.env.PG_POOL_MAX || 10),
    });
  }

  const jwtSecret =
    process.env.JWT_SECRET?.trim() ||
    process.env.SUPABASE_JWT_SECRET?.trim() ||
    fromSecret.JWT_SECRET?.trim() ||
    fromSecret.SUPABASE_JWT_SECRET?.trim();
  if (!jwtSecret) {
    throw new Error('JWT_SECRET / SUPABASE_JWT_SECRET must match production Worker signing secret');
  }

  const env: Env = {
    ENVIRONMENT: (process.env.ENVIRONMENT as Env['ENVIRONMENT']) || 'production',
    API_CORS_ORIGIN: process.env.API_CORS_ORIGIN || 'https://app.malconnexus.com',
    pgPool: pool,
    API_REQUIRE_AUTH: process.env.API_REQUIRE_AUTH || '1',
    JWT_SECRET: jwtSecret,
    SUPABASE_JWT_SECRET: jwtSecret,
    SUPABASE_JWT_AUD: process.env.SUPABASE_JWT_AUD || 'authenticated',
    LOGIN_OTP_SECRET:
      process.env.LOGIN_OTP_SECRET?.trim() || fromSecret.LOGIN_OTP_SECRET?.trim() || jwtSecret,
    TELEGRAM_BOT_TOKEN:
      process.env.TELEGRAM_BOT_TOKEN?.trim() || fromSecret.TELEGRAM_BOT_TOKEN?.trim(),
    TELEGRAM_WEBHOOK_SECRET:
      process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || fromSecret.TELEGRAM_WEBHOOK_SECRET?.trim(),
    AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
    S3_BUCKET_STAGE_PHOTOS:
      process.env.S3_BUCKET_STAGE_PHOTOS?.trim() || fromSecret.S3_BUCKET_STAGE_PHOTOS?.trim(),
    S3_BUCKET_ATTENDANCE_SELFIES:
      process.env.S3_BUCKET_ATTENDANCE_SELFIES?.trim() ||
      fromSecret.S3_BUCKET_ATTENDANCE_SELFIES?.trim(),
    S3_BUCKET_HR_KYC_UPLOADS:
      process.env.S3_BUCKET_HR_KYC_UPLOADS?.trim() || fromSecret.S3_BUCKET_HR_KYC_UPLOADS?.trim(),
    S3_PUBLIC_BASE_URL:
      process.env.S3_PUBLIC_BASE_URL?.trim() || fromSecret.S3_PUBLIC_BASE_URL?.trim(),
  };

  env.storageHooks = createS3StorageHooks(env);
  return env;
}

export async function closeAwsEnv(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

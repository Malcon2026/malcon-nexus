import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({});

export async function loadJsonSecret<T extends Record<string, string>>(
  secretId: string | undefined,
): Promise<Partial<T>> {
  if (!secretId?.trim()) return {};
  const res = await client.send(new GetSecretValueCommand({ SecretId: secretId.trim() }));
  const raw = res.SecretString;
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<T>;
  } catch {
    throw new Error(`Secret ${secretId} is not valid JSON`);
  }
}

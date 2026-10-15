#!/usr/bin/env node
/**
 * Build container and create/update AWS App Runner service (requires AWS CLI + ECR).
 *
 *   AWS_ACCOUNT_ID=... AWS_REGION=ap-south-1 ECR_REPO=malcon-nexus-api \
 *     node aws-api/scripts/deploy-apprunner.mjs
 *
 * Does not invent credentials. Exits with instructions when AWS CLI is unavailable.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const region = process.env.AWS_REGION || 'ap-south-1';
const account = process.env.AWS_ACCOUNT_ID?.trim();
const repo = process.env.ECR_REPO || 'malcon-nexus-api';
const serviceName = process.env.APP_RUNNER_SERVICE_NAME || 'malcon-nexus-api';

function awsOk() {
  const r = spawnSync('aws', ['sts', 'get-caller-identity'], { encoding: 'utf8' });
  return r.status === 0;
}

if (!awsOk()) {
  console.error('AWS CLI is not installed or not authenticated. Install AWS CLI v2 and configure credentials.');
  console.error('Then re-run this script or deploy the Dockerfile via App Runner console.');
  process.exit(1);
}

if (!account) {
  const id = spawnSync('aws', ['sts', 'get-caller-identity', '--query', 'Account', '--output', 'text'], {
    encoding: 'utf8',
  });
  if (id.status !== 0 || !id.stdout.trim()) {
    console.error('Set AWS_ACCOUNT_ID or ensure sts get-caller-identity works.');
    process.exit(1);
  }
  process.env.AWS_ACCOUNT_ID = id.stdout.trim();
}

const ecrUri = `${process.env.AWS_ACCOUNT_ID}.dkr.ecr.${region}.amazonaws.com/${repo}:latest`;

console.info(`Building Docker image ${ecrUri} ...`);
execSync(`docker build -f aws-api/Dockerfile -t ${repo}:latest ${root}`, { stdio: 'inherit', cwd: root });

console.info('Ensuring ECR repository exists...');
spawnSync('aws', ['ecr', 'describe-repositories', '--repository-names', repo, '--region', region], {
  stdio: 'ignore',
});
spawnSync('aws', ['ecr', 'create-repository', '--repository-name', repo, '--region', region], { stdio: 'ignore' });

execSync(
  `aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${process.env.AWS_ACCOUNT_ID}.dkr.ecr.${region}.amazonaws.com`,
  { stdio: 'inherit', shell: true },
);
execSync(`docker tag ${repo}:latest ${ecrUri}`, { stdio: 'inherit' });
execSync(`docker push ${ecrUri}`, { stdio: 'inherit' });

console.info(`
Image pushed: ${ecrUri}

Next (console or IaC):
1. Create App Runner service from ECR image ${ecrUri}
2. Set port 8080, health check path /health
3. Attach instance role with Secrets Manager read + S3 bucket access
4. Set env MALCON_API_SECRET_ARN (or individual env vars from aws-api/.env.example)
5. Note the service URL — set VITE_API_BASE_URL for Hostinger build

Service name hint: ${serviceName}
`);

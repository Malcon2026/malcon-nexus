import { USE_CLOUDFLARE_BACKEND } from './cloudflareConfig';

export type CloudflareIntegrationId =
  | 'caseAlerts'
  | 'email'
  | 'webPush'
  | 'hospitalSearchMappls'
  | 'bikeRoute';

export type IntegrationAvailability = {
  available: boolean;
  /** Plain-language reason when unavailable on Cloudflare backend. */
  reason: string;
};

const SUPABASE_EDGE_ONLY =
  'This feature still uses Supabase Edge Functions and is not wired to the AWS / Worker API yet.';

export function integrationAvailability(id: CloudflareIntegrationId): IntegrationAvailability {
  if (!USE_CLOUDFLARE_BACKEND) {
    return { available: true, reason: '' };
  }
  switch (id) {
    case 'caseAlerts':
      return { available: true, reason: '' };
    case 'email':
      return {
        available: false,
        reason: `${SUPABASE_EDGE_ONLY} Assignment email notifications are not sent.`,
      };
    case 'webPush':
      return {
        available: false,
        reason: `${SUPABASE_EDGE_ONLY} Browser push notifications are not sent.`,
      };
    case 'hospitalSearchMappls':
      return {
        available: false,
        reason: `${SUPABASE_EDGE_ONLY} Mappls hospital search is unavailable; Malcon hospital list search still works.`,
      };
    case 'bikeRoute':
      return {
        available: false,
        reason: `${SUPABASE_EDGE_ONLY} Bike route distance lookup is unavailable; enter km manually.`,
      };
    default:
      return { available: false, reason: 'Unknown integration.' };
  }
}

/** Log once per session when an integration is invoked but unavailable. */
const logged = new Set<CloudflareIntegrationId>();

export function logIntegrationSkipped(id: CloudflareIntegrationId): void {
  if (!USE_CLOUDFLARE_BACKEND) return;
  const info = integrationAvailability(id);
  if (info.available) return;
  if (logged.has(id)) return;
  logged.add(id);
  console.info(`[integrations] ${id} skipped on Cloudflare backend: ${info.reason}`);
}

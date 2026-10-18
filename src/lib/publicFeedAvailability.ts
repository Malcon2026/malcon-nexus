import { USE_AWS_BACKEND } from './cloudflareConfig';

/** Gallery + TV token feeds call Supabase Edge (`gallery-feed`); not on AWS API yet. */
export const GALLERY_TV_TOKEN_FEED_DEFERRED =
  'Gallery albums and TV kiosk links still use Supabase Edge Functions. They are unavailable while the app uses the AWS API. The in-app TV board (admin login) still works.';

export function isGalleryTvTokenFeedAvailable(): boolean {
  return !USE_AWS_BACKEND;
}

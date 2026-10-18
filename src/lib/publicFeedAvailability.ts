/** Gallery + TV token feeds use `/api/gallery-feed` on AWS/Worker, or Supabase Edge when legacy. */
export const GALLERY_TV_TOKEN_FEED_DEFERRED =
  'Gallery is not configured on the server (missing GALLERY_TOKEN). Ask admin to add it to the API secrets.';

export function isGalleryTvTokenFeedAvailable(): boolean {
  return true;
}

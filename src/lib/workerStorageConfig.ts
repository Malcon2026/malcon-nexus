/** When true, uploads/downloads use Worker → R2 instead of direct Supabase Storage. Default OFF. */
export const USE_WORKER_STORAGE = import.meta.env.VITE_USE_WORKER_STORAGE === 'true';

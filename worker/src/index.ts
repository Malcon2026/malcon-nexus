import type { Env } from './env';
import { handleAppRequest } from './app';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleAppRequest(request, env);
  },
};

import { createServer } from 'node:http';
import { handleAppRequest } from '../../worker/src/app.ts';
import { buildAwsEnv, closeAwsEnv } from './buildEnv.ts';

const port = Number(process.env.PORT || 8080);

const envPromise = buildAwsEnv();

const server = createServer(async (req, res) => {
  try {
    const env = await envPromise;
    const host = req.headers.host || `localhost:${port}`;
    const url = `http://${host}${req.url || '/'}`;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const body = Buffer.concat(chunks);

    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) {
      if (value == null) continue;
      if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
      else headers.set(key, value);
    }

    const request = new Request(url, {
      method: req.method,
      headers,
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
    });

    const response = await handleAppRequest(request, env);
    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') return;
      res.setHeader(key, value);
    });
    const buf = Buffer.from(await response.arrayBuffer());
    res.end(buf);
  } catch (e) {
    console.error(e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: { code: 'INTERNAL', message: 'Server error' } }));
  }
});

server.listen(port, () => {
  console.info(`Malcon Nexus AWS API listening on :${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await closeAwsEnv();
    process.exit(0);
  });
}

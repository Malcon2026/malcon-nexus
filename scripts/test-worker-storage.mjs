#!/usr/bin/env node
/** Worker storage abstraction — expects 501 when R2 buckets are not bound locally. */
const BASE = process.env.WORKER_BASE_URL || 'http://127.0.0.1:8787';

async function main() {
  const statusRes = await fetch(`${BASE}/api/storage/status`, { headers: { Accept: 'application/json' } });
  const status = await statusRes.json();
  if (statusRes.status !== 200) throw new Error(`status ${statusRes.status}`);
  console.log('Storage bindings:', status.data?.buckets);

  const form = new FormData();
  form.set('key', 'test/mock.jpg');
  form.set('contentType', 'image/jpeg');
  form.set('caseId', 'e5000002-0001-4001-8001-000000000002');
  form.set('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }));

  const uploadRes = await fetch(`${BASE}/api/storage/stage-photos/upload`, {
    method: 'POST',
    headers: {
      'X-Malcon-Dev-Identity': Buffer.from(
        JSON.stringify({
          authUserId: 'dev-employee',
          role: 'employee',
          employeeId: 'a1000001-0001-4001-8001-000000000001',
        }),
      ).toString('base64'),
    },
    body: form,
  });
  const uploadBody = await uploadRes.json();
  if (uploadRes.status === 501 && uploadBody.error?.code === 'NOT_CONFIGURED') {
    console.log('Upload correctly returns NOT_CONFIGURED without R2 bindings.');
    return;
  }
  if (uploadRes.status === 201) {
    console.log('Upload succeeded (R2 bound locally).', uploadBody.data);
    return;
  }
  throw new Error(`Unexpected upload response ${uploadRes.status}: ${JSON.stringify(uploadBody)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export async function telegramSendMessage(
  botToken: string,
  chatId: string | number,
  text: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || !body.ok) {
    return { ok: false, error: body.description ?? `HTTP ${res.status}` };
  }
  return { ok: true };
}

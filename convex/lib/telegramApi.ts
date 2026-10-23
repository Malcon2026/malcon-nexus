type TelegramApiBody = { ok?: boolean; description?: string; error_code?: number };

export async function telegramSendMessage(
  botToken: string,
  chatId: string | number,
  text: string,
  options?: { parseMode?: 'HTML' | 'Markdown' },
): Promise<{ ok: true } | { ok: false; error: string; errorCode?: number }> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...(options?.parseMode ? { parse_mode: options.parseMode } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as TelegramApiBody;
  if (!res.ok || !body.ok) {
    return { ok: false, error: body.description ?? `HTTP ${res.status}`, errorCode: body.error_code };
  }
  return { ok: true };
}

/** True when Telegram can reach the chat (user has not blocked the bot / chat id is valid). */
export function isStaleTelegramChatError(description: string | undefined): boolean {
  const d = (description ?? '').toLowerCase();
  return (
    d.includes('chat not found') ||
    d.includes('user is deactivated') ||
    d.includes('bot was blocked') ||
    d.includes('peer_id_invalid') ||
    d.includes("can't initiate conversation")
  );
}

export async function telegramChatReachable(
  botToken: string,
  chatId: string | number,
): Promise<boolean> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
  });
  const body = (await res.json().catch(() => ({}))) as TelegramApiBody;
  return body.ok === true;
}

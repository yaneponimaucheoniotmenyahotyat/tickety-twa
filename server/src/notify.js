// Сообщения от бота Tickety (Bot API sendMessage). Ошибки не роняют запрос:
// пользователь мог не запускать бота или запретить ему писать — тогда просто не доставим.
export function createNotifier({ botToken, log }) {
  return async function notify(chatId, text) {
    if (!botToken) return false;
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      });
      if (!res.ok) log?.info({ chatId, status: res.status }, 'бот не смог отправить сообщение');
      return res.ok;
    } catch (err) {
      log?.warn({ chatId, err: err.message }, 'нет связи с Telegram');
      return false;
    }
  };
}

// Короткая цитата для уведомления
export const excerpt = (text, max = 300) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

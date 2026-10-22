import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';

const AUTHOR_LABEL = { staff: 'Поддержка Tickety', bot: 'Помощник Tickety', user: null };

const time = (iso) =>
  new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Переписка в обращении. mine — чьи сообщения справа: 'user' у пользователя, 'staff' в админке.
// userName — подпись сообщений пользователя (в админке).
export function Messages({ messages, mine, userName }) {
  const end = useRef(null);
  // Тело в фигурных скобках: в новых браузерах scrollIntoView возвращает Promise,
  // а React принял бы его за функцию очистки эффекта и упал
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);
  return (
    <div className="space-y-2">
      {messages.map((m) => {
        const right = m.author === mine || (mine === 'staff' && m.author === 'bot');
        const label = m.author === 'user' ? userName : AUTHOR_LABEL[m.author];
        return (
          <div key={m.id} className={`flex ${right ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${
                right ? 'rounded-br-md bg-brand text-white' : 'rounded-bl-md bg-surface text-label shadow-sm'
              }`}
            >
              {label && !right && <p className="text-caption1 font-semibold text-brand">{label}</p>}
              <p className="whitespace-pre-wrap break-words text-body">{m.body}</p>
              <p className={`mt-0.5 text-right text-caption2 ${right ? 'text-white/70' : 'text-label-tertiary'}`}>
                {time(m.createdAt)}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={end} />
    </div>
  );
}

// Поле ответа внизу экрана. onSend(text) → Promise; ошибку показываем, текст не теряем.
export function Composer({ onSend, placeholder = 'Сообщение', disabled }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError(null);
    try {
      await onSend(body);
      setText('');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-separator/60 bg-bg/90 px-gutter pb-[calc(10px+var(--app-safe-bottom))] pt-2.5 backdrop-blur-xl">
      {error && <p className="mb-1.5 text-center text-footnote text-danger">{error}</p>}
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 2000))}
          placeholder={placeholder}
          rows={Math.min(5, Math.max(1, text.split('\n').length))}
          disabled={disabled}
          className="min-h-[44px] flex-1 resize-none rounded-2xl bg-fill px-3.5 py-2.5 text-body outline-none placeholder:text-label-tertiary"
        />
        <Button className="h-11" loading={busy} disabled={!text.trim() || disabled} onClick={send}>
          Отправить
        </Button>
      </div>
    </footer>
  );
}

export const THREAD_STATUS = {
  open: { label: 'Ждёт ответа', tone: 'neutral' },
  answered: { label: 'Есть ответ', tone: 'success' },
  closed: { label: 'Закрыто', tone: 'neutral' },
};

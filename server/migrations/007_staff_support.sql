-- Команда: роли выдаёт владелец (ADMIN_IDS) прямо в приложении.
--   moderator — события и модерация объявлений; support — обращения пользователей.
-- Человеку можно дать обе роли.
CREATE TABLE staff (
  user_id    BIGINT NOT NULL REFERENCES users(id),
  role       TEXT NOT NULL CHECK (role IN ('moderator', 'support')),
  added_by   BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

-- Обратная связь: обращение (тема) и переписка в нём.
-- status: open — ждёт ответа команды, answered — команда ответила, closed — закрыто.
CREATE TABLE support_threads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       BIGINT NOT NULL REFERENCES users(id),
  category      TEXT NOT NULL CHECK (category IN ('question', 'buying', 'selling', 'complaint')),
  listing_id    UUID REFERENCES listings(id), -- жалоба на объявление
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'answered', 'closed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX support_threads_user ON support_threads (user_id, updated_at DESC);
CREATE INDEX support_threads_status ON support_threads (status, updated_at DESC);

-- author: user — пользователь, staff — команда (имя сотрудника пользователю не показываем),
-- bot — автоответ (на будущее: ИИ-помощник до подключения оператора)
CREATE TABLE support_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  UUID NOT NULL REFERENCES support_threads(id) ON DELETE CASCADE,
  author     TEXT NOT NULL CHECK (author IN ('user', 'staff', 'bot')),
  author_id  BIGINT REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX support_messages_thread ON support_messages (thread_id, created_at);

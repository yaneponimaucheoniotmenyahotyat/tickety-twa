-- Согласие с юридическими документами (публичная оферта): кто, какую редакцию и когда принял.
-- Новая редакция — новая version: старое согласие её не покрывает, пользователь принимает заново.
CREATE TABLE legal_acceptances (
  user_id     BIGINT NOT NULL REFERENCES users(id),
  document    TEXT NOT NULL,
  version     TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, document, version)
);

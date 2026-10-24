// Имя и фамилия при регистрации — общие правила для формы и сервера.
// Буквы (русские и латинские), дефис, апостроф и пробел внутри: «Анна-Мария», «д'Артаньян».
const NAME_RE = /^[A-Za-zА-Яа-яЁё]+(?:[ '\-][A-Za-zА-Яа-яЁё]+)*$/;

export const NAME_MAX = 40;

// Лишние пробелы убираем — остальное оставляем как ввёл человек
export const cleanName = (s) => String(s ?? '').trim().replace(/\s+/g, ' ');

// Ошибка или null. field — «Имя» / «Фамилия» для текста ошибки
export function nameError(value, field) {
  const v = cleanName(value);
  if (!v) return `Укажите: ${field.toLowerCase()}`;
  if (v.length < 2) return `${field} — хотя бы 2 буквы`;
  if (v.length > NAME_MAX) return `${field} — не длиннее ${NAME_MAX} символов`;
  if (!NAME_RE.test(v)) return `${field}: только буквы, дефис и пробел`;
  return null;
}

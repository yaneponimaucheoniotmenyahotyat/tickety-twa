// Ошибка с HTTP-статусом и кодом для клиента: { error: code, message }
export class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class SessionNotFoundError extends SessionError {}
export class SessionValidationError extends SessionError {}
export class SessionConflictError extends SessionError {}
export class SessionForbiddenOperationError extends SessionError {}

export function toHttpError(err: unknown): { status: number; message: string } {
  if (err instanceof SessionNotFoundError) {
    return { status: 404, message: err.message };
  }
  if (err instanceof SessionValidationError) {
    return { status: 400, message: err.message };
  }
  if (err instanceof SessionConflictError) {
    return { status: 409, message: err.message };
  }
  if (err instanceof SessionForbiddenOperationError) {
    return { status: 403, message: err.message };
  }
  return { status: 500, message: "Internal Server Error" };
}

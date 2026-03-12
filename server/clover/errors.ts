export class CloverError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class CloverNotConnectedError extends CloverError {}
export class CloverAuthError extends CloverError {}
export class CloverApiError extends CloverError {}
export class CloverSyncValidationError extends CloverError {}

export function toHttpError(err: unknown): { status: number; message: string } {
  if (err instanceof CloverNotConnectedError) {
    return { status: 400, message: err.message };
  }
  if (err instanceof CloverAuthError) {
    return { status: 401, message: err.message };
  }
  if (err instanceof CloverApiError) {
    return { status: 502, message: err.message };
  }
  if (err instanceof CloverSyncValidationError) {
    return { status: 400, message: err.message };
  }
  return { status: 500, message: "Internal Server Error" };
}

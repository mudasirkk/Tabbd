export class CustomerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class CustomerNotFoundError extends CustomerError {}
export class CustomerValidationError extends CustomerError {}
export class CustomerConflictError extends CustomerError {}

export function toHttpError(err: unknown): { status: number; message: string } {
  if (err instanceof CustomerNotFoundError) {
    return { status: 404, message: err.message };
  }
  if (err instanceof CustomerValidationError) {
    return { status: 400, message: err.message };
  }
  if (err instanceof CustomerConflictError) {
    return { status: 409, message: err.message };
  }
  return { status: 500, message: "Internal Server Error" };
}

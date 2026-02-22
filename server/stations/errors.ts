export class StationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class StationNotFoundError extends StationError {}
export class StationValidationError extends StationError {}
export class StationConflictError extends StationError {}

export function toHttpError(err: unknown): { status: number; message: string } {
  if (err instanceof StationNotFoundError) {
    return { status: 404, message: err.message };
  }
  if (err instanceof StationValidationError) {
    return { status: 400, message: err.message };
  }
  if (err instanceof StationConflictError) {
    return { status: 409, message: err.message };
  }
  return { status: 500, message: "Internal Server Error" };
}

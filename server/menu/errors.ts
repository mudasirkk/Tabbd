export class MenuError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class MenuNotFoundError extends MenuError {}

export function toHttpError(err: unknown): { status: number; message: string } {
  if (err instanceof MenuNotFoundError) {
    return { status: 404, message: err.message };
  }
  return { status: 500, message: "Internal Server Error" };
}

export class HttpException extends Error {
  statusCode: number;
  code: string;
  details?: any;
  cause?: unknown;

  constructor(
    statusCode: number,
    message: string,
    code?: string,
    details?: unknown,
    cause?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code ?? HttpException.defaultCode(statusCode);
    this.details = details;
    this.cause = cause;

    Object.setPrototypeOf(this, HttpException.prototype);
  }

  static defaultCode(status: number): string {
    const map: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "UNPROCESSABLE_ENTITY",
      500: "INTERNAL_ERROR"
    };
    return map[status] ?? "ERROR";
  }
}

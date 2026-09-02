
declare namespace Express {
    export interface Request {
      log: import("pino").Logger;
      requestId: string;
      validated?: {
        query?: unknown;
        body?: unknown;
        params?: unknown;
      };
    }
  }
  
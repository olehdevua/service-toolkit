import * as http from "http";

export interface Initializable<T> {
  new (...args: any[]): T;
  init(): Promise<T>;
  initSingle(): Promise<T>;
}

export type HttpControllerHandleOpts = {
  pathname: string;
  context: {
    traceId: string;
    spanId: string;
  }
}
export interface HttpController {
  handle(
    req: http.IncomingMessage,
    resp: http.ServerResponse,
    opts: HttpControllerHandleOpts,
  ): Promise<void>;
}

export type HTTPMethod = "POST" | "GET" | "SEARCH" | "DELETE" | "PUT" | "PATCH";
export type MethodHandlers = Partial<Record<HTTPMethod, HttpController>>;

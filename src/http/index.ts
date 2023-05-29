import { v1 } from "uuid";
import * as http from "http";
import { GeneralError } from "../errors.js";
import {
  BaseService,
  Logger,
  LoggerParams,
} from "../index.js";
import { HttpController, HttpControllerHandleOpts, HTTPMethod, Initializable, MethodHandlers } from "./types.js";
import { getPath, getQuery } from "./http.misc.js";
import { getJSBody } from "./http.get-body.js";
import {
  JSONSerializer,
  SerializerManager
} from "./http.serialize.js";
import { ErrorSender, HttpRespSender } from "./http.send.js";

export * from "./http.misc.js";
export * from "./http.get-body.js";
export * from "./http.send.js";
export * from "./http.client.js";
export * as security from "./http.security.js";
export * from "./types.js";

export class HttpServer {
  constructor(
    private router: Router,
    public server: http.Server = http.createServer(),
  ) {}

  start(port: number): Promise<void> {
    this.server.on("request", (req, resp) => {
      const traceId = req.headers["x-trace-id"] as string || v1();
      const spanId = v1();

      // const url = new URL(req.url as string);
      const pathname = getPath(req);
      this.router.handle(req, resp, { context: { traceId, spanId }, pathname });
    });

    // this.server.on("close"); ?? graceful shutdown?

    return new Promise(ok => {
      this.server.listen(port, "0.0.0.0", () => ok());
    });
  }
}

type BaseRoute = {
  path: string,
  methods: MethodHandlers
};
// NOTE: not sure if it should to implement `HttpController`
export class Router implements HttpController {
  private routes: Record<string, MethodHandlers> = {};
  private baseRoutes: BaseRoute[] = [];

  constructor(
    private logger: Logger,
  ) {}

  async add(
    controllerInit: Initializable<HttpController>,
    o: {
      single?: boolean;
      pathname: string;
      method: HTTPMethod;
    }
  ): Promise<void> {
    const controller = (o.single ?? true)
      ? await controllerInit.initSingle()
      : await controllerInit.init();

    let pathHandlers = this.routes[o.pathname];
    if (!pathHandlers) {
      pathHandlers = {};
      this.routes[o.pathname] = pathHandlers;
    }

    pathHandlers[o.method] = controller;
  }

  async addBase(
    controllerInit: Initializable<HttpController>,
    o: {
      single?: boolean;
      pathname: string;
      method: HTTPMethod;
    }
  ): Promise<void> {
    const controller = (o.single ?? true)
      ? await controllerInit.initSingle()
      : await controllerInit.init();

    let basePathHandlers = this.baseRoutes
      .find(br => o.pathname.startsWith(br.path));

    if (!basePathHandlers) {
      basePathHandlers = { path: o.pathname, methods: {} };
      this.baseRoutes.push(basePathHandlers);
    }

    basePathHandlers.methods[o.method] = controller;
  }

  async handle(
    req: http.IncomingMessage,
    resp: http.ServerResponse,
    { context, pathname }: HttpControllerHandleOpts
  ): Promise<void> {
    const logger = this.logger.clone({ ctx: context });
    const sender = HttpRespSender.init(req, resp);
    const serializerManager = new SerializerManager(req.headers);

    serializerManager.add(new JSONSerializer());
    const serializer = serializerManager.findSerializer();

    // always string for `req` received `http.Server`
    const method = req.method as HTTPMethod;

    const methodHandlers = this.findMethodHandlers(pathname);
    if (!methodHandlers) {
      const body = serializer.serialize(
        { error: "No action for route", params: { pathname, method } }
      );
      await sender.send(body, { status: 404 });
      return;
    }

    const controller = methodHandlers[method];
    if (!controller) {
      const body = serializer.serialize(
        { error: "Method is not allowed", params: { pathname, method } }
      );
      await sender.send(body, { status: 405 });
      return;
    }

    try {
      logger.info("handle http endpoint", { method, pathname });
      await controller.handle(req, resp, { context, pathname });
    } catch(err) {
      const error = GeneralError.mapToValue(err);
      error.params.pathname = pathname;

      const { message, ...rest } = error;

      logger.error(message, rest as unknown as LoggerParams);

      const errSender = new ErrorSender(sender, serializer, logger);
      await errSender.send(error);
    }
  }

  private findMethodHandlers(pathname: string): MethodHandlers | void {
    let methodHandlers = this.routes[pathname];
    if (!methodHandlers) {
      const baseMethodHandlers = this.baseRoutes
        .find(br => pathname.startsWith(br.path));
      if (baseMethodHandlers) methodHandlers = baseMethodHandlers.methods;
    }
    return methodHandlers;
  }
}

export class ActionHttpController implements HttpController
{
  constructor(
    private service: BaseService<any,any>,
    private o: {
      successStatus: number,
      httpBodyLimit?: number,
    }
  ) {}

  async handle(
    req: http.IncomingMessage,
    resp: http.ServerResponse,
    opts: HttpControllerHandleOpts
  ): Promise<void> {
    const content = await getJSBody(req, this.o.httpBodyLimit);

    const result = await this.service.run(content, {
      credentials: { token: "fuck the police" },
      context: opts.context
    });
    const serializerManager = new SerializerManager(req.headers);
    serializerManager.add(new JSONSerializer());

    const serializer = serializerManager.findSerializer();
    const body = serializer.serialize({ data: result });

    const sender = HttpRespSender.init(req, resp);
    await sender.send(body, { status: this.o.successStatus });
  }
}

export class QueryHttpController implements HttpController
{
  constructor(
    private service: BaseService<never, never>,
    private o: {
      successStatus: number,
      httpBodyLimit?: number,
    }
  ) {}

  async handle(
    req: http.IncomingMessage,
    resp: http.ServerResponse,
    opts: HttpControllerHandleOpts
  ): Promise<void> {
    const content = getQuery(req);

    const result = await this.service.run(content, {
      credentials: { token: "fuck the police" },
      context: opts.context
    });
    const serializerManager = new SerializerManager(req.headers);
    serializerManager.add(new JSONSerializer());

    const serializer = serializerManager.findSerializer();
    const body = serializer.serialize({ data: result });

    const sender = HttpRespSender.init(req, resp);
    await sender.send(body, { status: this.o.successStatus });
  }
}


// type SenderOpts = {
//   content: {
//     type?: string;
//     enc?: string;
//     lang?: string;
//     length?: string;
//     range?: string;
//   };
//   status: number;
//   pathname: string;
// }
//
// export class HttpSender {
//   constructor(
//     protected req: http.IncomingMessage,
//     protected resp: http.ServerResponse,
//     protected o: SenderOpts
//   ) {}
//
//   /**
//    * Why return `boolean`?
//    * Because from p-o-v of sender, the fact that it was not
//    * able to send data is not an error, lets consumer of this
//    * class to decide this is an error or no.
//    *
//    * So, only some error on the way to eventually call `stream.end`
//    * are errors, otherwise this is no error, but just boolean result
//    *
//    * @returns Promise<boolean>
//    */
//   send(
//     body: Buffer | string | Uint8Array = ""
//   ): Promise<boolean> {
//     const { content, status, pathname } = this.o;
//
//     if (this.resp.headersSent) {
//       throw new HttpError(
//         "HttpSender#send: can't set headers after they are sent",
//         { params: { pathname }, httpStatus: 500 }
//       );
//     }
//
//     // HEAD support
//     if (this.req.method === "HEAD") {
//       return new Promise(ok => this.resp.end(ok));
//     }
//
//     if (content.type) this.resp.setHeader("Content-Type", content.type);
//     if (content.type === null) this.resp.removeHeader("Content-Type");
//
//     if (content.enc) this.resp.setHeader("Content-Encoding", content.enc);
//     if (content.enc === null) this.resp.removeHeader("Content-Encoding");
//
//     if (content.length) this.resp.setHeader("Content-Length", content.length);
//     if (content.length === null) this.resp.removeHeader("Content-Length");
//
//     if (content.lang) this.resp.setHeader("Content-Language", content.lang);
//     if (content.lang === null) this.resp.removeHeader("Content-Language");
//
//     if (content.range) this.resp.setHeader("Content-Range", content.range);
//     if (content.range === null) this.resp.removeHeader("Content-Range");
//
//     this.resp.statusCode = status;
//
//     return new Promise((resolve, reject) => {
//       this.resp.end(body, () => resolve(true));
//       this.resp.on("error", reject);
//     });
//   }
// }


// Set an object of headers on a response.
// function setHeaders(res: http.ServerResponse, headers: Record<string, string>) {
//   for (const [ header, value ] of Object.entries(headers)) {
//     res.setHeader(header, value);
//   }
// }

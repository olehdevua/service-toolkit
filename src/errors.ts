// enum ErrorCode {
//   // http
//   BODY_SIZE_NOT_MATCH = "E_BODY_SIZE_NOT_MATCH",
//   BODY_UNSUPPORTED_TYPE = "E_BODY_UNSUPPORTED_TYPE",
//   BODY_NO_TYPE = "E_BODY_NO_TYPE",
//   GENERIC = "E_HTTP_GENERIC",
//   // business
//   VALIDATION = "E_APP_VALIDATION",
//   NOT_EXIST = "E_APP_NOT_EXIST"
// }

type ErrorParams = Record<string, unknown>;
export type ErrorValue = {
  message: string;
  stack?: string;
  code: string;
  params: ErrorParams;
  httpStatus: number;
};
type ErrorOpts = {
  cause?: Error,
  params?: ErrorParams,
  code?: string,
  httpStatus?: number
};

export class GeneralError extends Error {
  public readonly params: ErrorParams;
  public readonly code: string = "EGENERAL";
  public readonly httpStatus: number = 500;
  public readonly retriable: boolean = this.httpStatus >= 500;

  constructor(
    msg: string,
    opts: ErrorOpts  = {}
  ) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    super(msg, opts.cause ? { cause: opts.cause } : undefined);
    this.params = opts.params || {};

    if (typeof opts.code === "string") {
      this.code = opts.code;
    }
    if (typeof opts.httpStatus === "number") {
      this.httpStatus = opts.httpStatus;
    }
  }

  static extractCause(err: Error) {
    let e = err;
    let message = e.message;

    while (e.cause instanceof Error) {
      e = e.cause;
      message += e.message;
    }

    return {
      message,
      stack: e.stack || err.stack,
    };
  }

  static mapToValue(err: unknown): ErrorValue {
    let error: ErrorValue = {
      message: `${err}`,
      code: "EUNKNOWN",
      params: {},
      httpStatus: 500,
    };

    if (err instanceof Error) {
      return {
        ...error,
        ...GeneralError.extractCause(err),
      };
    }
    if (err instanceof GeneralError) {
      return err.valueOf();
    }

    return error;
  }

  valueOf(): ErrorValue {
    const { message, stack } = GeneralError.extractCause(this);

    return {
      message,
      stack,
      code: this.code,
      params: this.params,
      httpStatus: this.httpStatus,
    };
  }
}

//
// === Http Errors ===
//

export class HttpError extends GeneralError {
  constructor(
    msg = "Bad Request",
    opts: ErrorOpts = {}
  ) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    super(msg, { code: "EHTTPERROR", ...opts });
  }
}

//
// === App Errors ===
//

export class ValidationError extends GeneralError {
  public readonly code: string = "EVALIDATION";

  constructor(message: string, opts: ErrorOpts = {}) {
    const o = { httpStatus: 400,  ...opts };
    super(message, o);
  }
}

export class NotFoundError extends GeneralError {
  public readonly code: string = "ENOTFOUND";
  public readonly httpStatus: number = 404;
}

export class NotAuthenticated extends GeneralError {
  public readonly code: string = "ENOTAUTHENTICATED";
  public readonly httpStatus: number = 401;
}

export class NotAuthorized extends GeneralError {
  public readonly code: string = "ENOTAUTHORIZED";
  public readonly httpStatus: number = 403;
}

export class ConflictError extends GeneralError {
  public readonly code: string = "ECONFLICT";
  public readonly httpStatus: number = 409;
}

// What is wrong with it?
// it's responsibility of my `mongodb client` to deal with
// connection errors, other part of app should be abstracted
// from it by this client, and the fact that it throws
// `DbConnectionError` to any other part of app is just
// stupid.
// It's like a cleaner/janitor report to `central office`
// that it's dirty in a room, what `central office` can do,
// the cleaner/janitor is the only one which can handle it.
// Of course if it's not approach described by @VovaDan
// that mongo `find/update/etc` fails, and you have
// mongo middleware, which catch this error, and restart
// connection, but, this is the case when your `module`
// logic(here it's `mongodb client`) is spread through the
// whole app.
//
// export class DBConnectionError extends GenericError {
//   public readonly code: string = "E_DB_CONNECTION";
//   public readonly httpStatus: number = 500; // maybe 5xx?
// }
//
// The same is here. (DBInvalidError)
// If I can't create `mongo collection`(mongodb package
// throws an error), I throw this error (and hide possible
// info/reason which is provided in mongodb-package error).
// But for which layer I throw this error? What layer gonna
// handle it otherwise like just pass it above to
// the `top most` layer, which just report it, and stops
// the app.
// Even if some layer knows how to deal with it, it's
// just a `general` error for it, layers bellow shouldn't
// know about any problems with connections in mongo.
//
// NOTE: I use just DBError in MongodbClient (no specific,
// like DB_INVALID).
// Why? Because `mongodb` doesn't give good enough message,
// however it can, that is my approach works, approach - that
// you need only stack + info from actual error, without
// some info in a middle, like controller/action/etc.
// Also, we don't really care too much about mongodb stack
//
// NOTE: (2021-nov-3)
// Propose to have DBOpsError and DBDevError (names subject to change)
// Ops errors is like `connection` failed, so kafka/rabbit controller
// can reschedule event (or service handle it some other way)
// Dev error (for example invalid schema of inserted object)
export class DBError extends GeneralError {
  public readonly code: string = "EDB";
  public readonly httpStatus: number = 400;
}

export class DBOpsError extends GeneralError {
  public readonly code: string = "EDBOPS";
  public readonly httpStatus: number = 500; // maybe 5xx?
}

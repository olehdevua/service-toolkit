export class GeneralError extends Error {
    params = {};
    code = "EGENERAL";
    httpStatus = 500;
    constructor(msg, opts = {}) {
        super(msg, opts.cause ? { cause: opts.cause } : undefined);
        this.params = opts.params;
        if (typeof opts.code === "string") {
            this.code = opts.code;
        }
        if (typeof opts.httpStatus === "number") {
            this.httpStatus = opts.httpStatus;
        }
    }
    valueOf() {
        let e = this;
        let message = e.message;
        while (e.cause instanceof Error) {
            e = e.cause;
            message += e.message;
        }
        const value = {
            message,
            stack: e.stack || this.stack || "<stack missing>",
            code: this.code,
            params: undefined,
        };
        if (this instanceof ValidationError) {
            value.params = this.params;
        }
        return value;
    }
}
export class HttpError extends GeneralError {
    constructor(msg = "Bad Request", opts = {}) {
        super(msg, { code: "EHTTPERROR", ...opts });
    }
}
export class ValidationError extends GeneralError {
    code = "EVALIDATION";
    httpStatus = 400;
}
export class NotFoundError extends GeneralError {
    code = "ENOTFOUND";
    httpStatus = 404;
}
export class DBError extends GeneralError {
    code = "EDB";
    httpStatus = 500;
}
export class DBOpsError extends GeneralError {
    code = "EDBOPS";
    httpStatus = 500;
}
//# sourceMappingURL=errors.js.map
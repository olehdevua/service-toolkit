declare type ErrorParams = Record<string, unknown>;
declare type ErrorValue = {
    message: string;
    stack: string;
    code: string;
    params: undefined | ErrorParams;
};
declare type ErrorOpts = {
    cause?: Error;
    params?: ErrorParams;
    code?: string;
    httpStatus?: number;
};
export declare class GeneralError extends Error {
    readonly params?: ErrorParams;
    readonly code: string;
    readonly httpStatus: number;
    constructor(msg: string, opts?: ErrorOpts);
    valueOf(): ErrorValue;
}
export declare class HttpError extends GeneralError {
    constructor(msg?: string, opts?: ErrorOpts);
}
export declare class ValidationError extends GeneralError {
    readonly code: string;
    readonly httpStatus: number;
}
export declare class NotFoundError extends GeneralError {
    readonly code: string;
    readonly httpStatus: number;
}
export declare class DBError extends GeneralError {
    readonly code: string;
    readonly httpStatus: number;
}
export declare class DBOpsError extends GeneralError {
    readonly code: string;
    readonly httpStatus: number;
}
export {};
//# sourceMappingURL=errors.d.ts.map
export * from "./clients/index.js";
export * from "./errors.js";
export * from "./validator.js";
export * as h from "./http/index.js";
export * as crypto from "./crypto.js";
export * as perf from "./performance.js";
export * as swagger from "./swagger.js";
export interface Model<T> {
    update(patch: Record<string, unknown>): void;
    getContent(): T;
}
export declare type ServiceMeta = {
    credentials: {
        token?: string;
    };
    context: {
        traceId: string;
        spanId: string;
    };
};
export interface Service {
    process(content: Record<string, unknown>, meta: ServiceMeta): Promise<Record<string, unknown>>;
}
//# sourceMappingURL=index.d.ts.map
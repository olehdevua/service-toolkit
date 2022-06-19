/// <reference types="node" resolution-mode="require"/>
import http from "http";
declare type XFrameDirective = "SAMEORIGIN" | "DENY";
export declare function setXFrameOptions(resp: http.ServerResponse, directive: XFrameDirective): void;
declare const REFERRER_POLICIES: {
    "no-referrer": boolean;
    "no-referrer-when-downgrade": boolean;
    "same-origin": boolean;
    origin: boolean;
    "strict-origin": boolean;
    "origin-when-cross-origin": boolean;
    "strict-origin-when-cross-origin": boolean;
    "unsafe-url": boolean;
};
declare type ReferrerPolicy = keyof typeof REFERRER_POLICIES;
export declare function setReferrerPolicy(resp: http.ServerResponse, opts: {
    policy: ReferrerPolicy;
    fallbackPolicy?: ReferrerPolicy;
}): void;
export {};
//# sourceMappingURL=http.security.d.ts.map
/// <reference types="node" resolution-mode="require"/>
import * as http from "http";
export declare type ContentType = "json" | "urlencoded";
export declare function encodeUrl(url: string): string;
export declare function escapeHtml(strToEscape: string): string;
export declare function getContentType(req: http.IncomingMessage): ContentType;
export declare function getContentLength(req: http.IncomingMessage): number;
export declare function parseURLEncoded(body: string): Record<string, string | string[]>;
export declare function getQuery(req: http.IncomingMessage): Readonly<Record<string, unknown>>;
export declare function getPath(req: http.IncomingMessage): string;
export declare function removeContentHeaderFields(res: http.ServerResponse): void;
export declare function sendText(resp: http.ServerResponse, result: string, { status, type }: {
    status: number;
    type: string;
}): Promise<void>;
//# sourceMappingURL=http.misc.d.ts.map
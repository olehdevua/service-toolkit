/// <reference types="node" resolution-mode="require"/>
import * as http from "node:http";
import { GeneralError } from "../errors.js";
import { Logger } from "../index.js";
declare type DotFilesAction = "ignore" | "allow" | "deny";
export declare type SendStreamOpts = {
    acceptRanges: boolean;
    cacheControl: boolean;
    etag: boolean;
    hidden: boolean;
    dotfiles: DotFilesAction;
    extensions: string[];
    immutable: boolean;
    index: string[];
    lastModified: boolean;
    maxage: number;
    root?: string;
    path: string;
    start?: number;
    end?: number;
};
export declare class FileSender {
    private req;
    private logger;
    private opts;
    private constructor();
    static init(req: http.IncomingMessage, logger: Logger, options: Record<string, unknown>): FileSender;
    send(res: http.ServerResponse, opts?: {
        onError?: (err: Error) => Promise<void>;
    }): Promise<void>;
    private setHeaders;
    private handleCaching;
    private handleRanges;
    sendError(res: http.ServerResponse, err: GeneralError): Promise<void>;
}
export {};
//# sourceMappingURL=http.send.d.ts.map
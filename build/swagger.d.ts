/// <reference types="node" resolution-mode="require"/>
import * as http from "node:http";
import { HttpControllerHandleOpts } from "./http/types.js";
import { Logger, h } from "./index.js";
declare type GenerateHtmlOpts = {
    customCssUrl?: string;
    customCss?: string;
    customJs?: string;
    customJsStr?: string;
    customfavIcon?: string;
    swaggerUrl?: string;
    swaggerUrls?: string[];
    isExplorer?: boolean;
    customSiteTitle?: string;
    htmlTplString?: string;
    jsTplString?: string;
    swaggerOptions?: Record<string, unknown>;
};
export declare class OpenAPIAssetsController implements h.HttpController {
    private logger;
    private swaggerInitJS;
    private sendOpts;
    constructor(logger: Logger, swaggerInitJS: string, sendOpts: Partial<h.SendStreamOpts>);
    static init(logger: Logger, sendOpts: Partial<h.SendStreamOpts>, swaggerInitJS: string): OpenAPIAssetsController;
    handle(req: http.IncomingMessage, resp: http.ServerResponse, { context }: HttpControllerHandleOpts): Promise<void>;
}
export declare class OpenAPIDocController implements h.HttpController {
    private html;
    jsInit: string;
    constructor(html: string, jsInit: string);
    static init(openApiDoc: Record<string, unknown>, openApiOpts: GenerateHtmlOpts): OpenAPIDocController;
    handle(_req: http.IncomingMessage, resp: http.ServerResponse): Promise<void>;
}
export {};
//# sourceMappingURL=swagger.d.ts.map
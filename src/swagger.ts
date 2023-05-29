import * as http from "node:http";
import * as swaggerUi from "swagger-ui-dist";
import { HttpControllerHandleOpts } from "./http/types.js";
import { Logger, h } from "./index.js";

type GenerateHtmlOpts = {
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
}

const favIconHtml = "<link rel=\"icon\" type=\"image/png\" href=\"./favicon-32x32.png\" sizes=\"32x32\" />" +
  "<link rel=\"icon\" type=\"image/png\" href=\"./favicon-16x16.png\" sizes=\"16x16\" />";

const htmlTplString = `
<!-- HTML for static distribution bundle build -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title><% title %></title>
  <link rel="stylesheet" type="text/css" href="./swagger-ui.css" >
  <% favIconString %>
  <style>
    html
    {
      box-sizing: border-box;
      overflow: -moz-scrollbars-vertical;
      overflow-y: scroll;
    }
    *,
    *:before,
    *:after
    {
      box-sizing: inherit;
    }
    body {
      margin:0;
      background: #fafafa;
    }
  </style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="position:absolute;width:0;height:0">
  <defs>
    <symbol viewBox="0 0 20 20" id="unlocked">
      <path d="M15.8 8H14V5.6C14 2.703 12.665 1 10 1 7.334 1 6 2.703 6 5.6V6h2v-.801C8 3.754 8.797 3 10 3c1.203 0 2 .754 2 2.199V8H4c-.553 0-1 .646-1 1.199V17c0 .549.428 1.139.951 1.307l1.197.387C5.672 18.861 6.55 19 7.1 19h5.8c.549 0 1.428-.139 1.951-.307l1.196-.387c.524-.167.953-.757.953-1.306V9.199C17 8.646 16.352 8 15.8 8z"></path>
    </symbol>
    <symbol viewBox="0 0 20 20" id="locked">
      <path d="M15.8 8H14V5.6C14 2.703 12.665 1 10 1 7.334 1 6 2.703 6 5.6V8H4c-.553 0-1 .646-1 1.199V17c0 .549.428 1.139.951 1.307l1.197.387C5.672 18.861 6.55 19 7.1 19h5.8c.549 0 1.428-.139 1.951-.307l1.196-.387c.524-.167.953-.757.953-1.306V9.199C17 8.646 16.352 8 15.8 8zM12 8H8V5.199C8 3.754 8.797 3 10 3c1.203 0 2 .754 2 2.199V8z"/>
    </symbol>
    <symbol viewBox="0 0 20 20" id="close">
      <path d="M14.348 14.849c-.469.469-1.229.469-1.697 0L10 11.819l-2.651 3.029c-.469.469-1.229.469-1.697 0-.469-.469-.469-1.229 0-1.697l2.758-3.15-2.759-3.152c-.469-.469-.469-1.228 0-1.697.469-.469 1.228-.469 1.697 0L10 8.183l2.651-3.031c.469-.469 1.228-.469 1.697 0 .469.469.469 1.229 0 1.697l-2.758 3.152 2.758 3.15c.469.469.469 1.229 0 1.698z"/>
    </symbol>
    <symbol viewBox="0 0 20 20" id="large-arrow">
      <path d="M13.25 10L6.109 2.58c-.268-.27-.268-.707 0-.979.268-.27.701-.27.969 0l7.83 7.908c.268.271.268.709 0 .979l-7.83 7.908c-.268.271-.701.27-.969 0-.268-.269-.268-.707 0-.979L13.25 10z"/>
    </symbol>
    <symbol viewBox="0 0 20 20" id="large-arrow-down">
      <path d="M17.418 6.109c.272-.268.709-.268.979 0s.271.701 0 .969l-7.908 7.83c-.27.268-.707.268-.979 0l-7.908-7.83c-.27-.268-.27-.701 0-.969.271-.268.709-.268.979 0L10 13.25l7.418-7.141z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="jump-to">
      <path d="M19 7v4H5.83l3.58-3.59L8 6l-6 6 6 6 1.41-1.41L5.83 13H21V7z"/>
    </symbol>
    <symbol viewBox="0 0 24 24" id="expand">
      <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z"/>
    </symbol>
  </defs>
</svg>
<div id="swagger-ui"></div>
<script src="./swagger-ui-bundle.js"> </script>
<script src="./swagger-ui-standalone-preset.js"> </script>
<script src="./swagger-ui-init.js"> </script>
<% customJs %>
<% customJsStr %>
<% customCssUrl %>
<style>
  <% customCss %>
</style>
</body>
</html>
`;

const jsTplString = `
window.onload = function() {
  // Build a system
  var url = window.location.search.match(/url=([^&]+)/);
  if (url && url.length > 1) {
    url = decodeURIComponent(url[1]);
  } else {
    url = window.location.origin;
  }
  <% swaggerOptions %>
  url = options.swaggerUrl || url
  var urls = options.swaggerUrls
  var customOptions = options.customOptions
  var spec1 = options.swaggerDoc
  var swaggerOptions = {
    spec: spec1,
    url: url,
    urls: urls,
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
    layout: "StandaloneLayout"
  }
  for (var attrname in customOptions) {
    swaggerOptions[attrname] = customOptions[attrname];
  }
  var ui = SwaggerUIBundle(swaggerOptions)
  if (customOptions.oauth) {
    ui.initOAuth(customOptions.oauth)
  }
  if (customOptions.authAction) {
    ui.authActions.authorize(customOptions.authAction)
  }
  window.ui = ui
}
`;

export class OpenAPIAssetsController implements h.HttpController {
  private root = swaggerUi.getAbsoluteFSPath();

  constructor(
    private logger: Logger,
    private swaggerInitJS: string,
  ) {}

  async handle(
    req: http.IncomingMessage,
    resp: http.ServerResponse,
    { context, pathname }: HttpControllerHandleOpts,
  ) {
    const logger = this.logger.clone({ ctx: context });
    logger.debug("Swagger asset path", { pathname });

    if (pathname === "/swagger-ui-init.js") {
      return h.send(resp, this.swaggerInitJS, {
        status: 200,
        type: "application/javascript"
      });
    }

    const ss = h.FileSender.init(
      req, resp, logger, { file: { pathname } }
    );
    await ss.send();
  }
}

export class OpenAPIDocController implements h.HttpController {
  constructor(
    // private openApiDoc: Record<string, any>,
    // private openApiOpts: GenerateHtmlOpts,
    private html: string,
    public jsInit: string,
  ) {}

  static init(
    openApiDoc: Record<string, unknown>,
    openApiOpts: GenerateHtmlOpts,
  ) {
    const [ html, jsInit ] = generateHTML(openApiDoc, openApiOpts);
    return new OpenAPIDocController(html, jsInit);
  }

  // like legacy `setup`
  async handle(
    _req: http.IncomingMessage,
    resp: http.ServerResponse,
  ) {
    await new Promise(ok => resp.end(this.html, () => ok(undefined)));
  }
}


function generateHTML(
  swaggerDoc: Record<string, unknown>,
  opts: GenerateHtmlOpts
): [string, string] {
  const o = {
    htmlTplString,
    jsTplString,
    isExplorer: false,
    customSiteTitle: "Swagger UI",
    ...opts,
  };
  const isExplorer = o.isExplorer || !!o.swaggerUrls;
  const explorerString = isExplorer ? "" : ".swagger-ui .topbar .download-url-wrapper { display: none }";
  const customCss = explorerString + " " + o.customCss || explorerString;

  const favIconString = o.customfavIcon ? "<link rel=\"icon\" href=\"" + o.customfavIcon + "\" />" : favIconHtml;
  const htmlWithCustomCss = o.htmlTplString.toString().replace("<% customCss %>", customCss);
  const htmlWithFavIcon = htmlWithCustomCss.replace("<% favIconString %>", favIconString);
  const htmlWithCustomJsUrl = htmlWithFavIcon.replace("<% customJs %>", o.customJs ? `<script src="${o.customJs}"></script>` : "");
  const htmlWithCustomJs = htmlWithCustomJsUrl.replace("<% customJsStr %>", o.customJsStr ? `<script>${o.customJsStr}</script>` : "");
  const htmlWithCustomCssUrl = htmlWithCustomJs.replace("<% customCssUrl %>", o.customCssUrl ? `<link href="${o.customCssUrl}" rel="stylesheet">` : "");

  const initOptions = {
    swaggerDoc: swaggerDoc || undefined,
    customOptions: o.swaggerOptions || {},
    swaggerUrl: o.swaggerUrl || undefined,
    swaggerUrls: o.swaggerUrls || undefined
  };

  const swaggerInit = o.jsTplString.toString().replace("<% swaggerOptions %>", stringify(initOptions));
  const html = htmlWithCustomCssUrl.replace("<% title %>", o.customSiteTitle);

  return [ html, swaggerInit ];
}

function stringify(obj: Record<string, unknown>) {
  const placeholder = "____FUNCTIONPLACEHOLDER____";
  // eslint-disable-next-line @typescript-eslint/ban-types
  const fns: Function[] = [];
  let json = JSON.stringify(obj, function (_key, value) {
    if (typeof value === "function") {
      fns.push(value);
      return placeholder;
    }
    return value;
  }, 2);
  json = json.replace(new RegExp("\"" + placeholder + "\"", "g"), function () {
    return fns.shift()?.toString() || "";
  });
  return "var options = " + json + ";";
}

import http from "http";

// `ALLOW-FROM` [is obsolete](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options)
type XFrameDirective = "SAMEORIGIN" | "DENY";
const X_FRAME_DIRECTIVES = [ "SAMEORIGIN", "DENY" ];

// This header is superseded by the `frame-ancestors`
// `Content-Security-Policy` directive but is still
// useful on old browsers.
export function setXFrameOptions(
  resp: http.ServerResponse,
  directive: XFrameDirective
): void {
  if (!X_FRAME_DIRECTIVES.includes(directive)) {
    throw new Error(`xFrameDirective has unacceptable value. directive = ${directive}`);
  }

  resp.setHeader("X-Frame-Options", directive);
}

const REFERRER_POLICIES = {
  "no-referrer": true,
  "no-referrer-when-downgrade": true,
  "same-origin": true,
  "origin": true,
  "strict-origin": true,
  "origin-when-cross-origin": true,
  "strict-origin-when-cross-origin": true,
  "unsafe-url": true,
};
type ReferrerPolicy = keyof typeof REFERRER_POLICIES;

export function setReferrerPolicy(resp: http.ServerResponse, opts: {
  policy: ReferrerPolicy,
  fallbackPolicy?: ReferrerPolicy
}): void {
  if (!REFERRER_POLICIES[opts.policy]) {
    throw new Error(`ReferrerPolicy has unacceptable value. policy = ${opts.policy}`);
  }

  const fallbackPolicy = opts.fallbackPolicy || "no-referrer";

  if (!REFERRER_POLICIES[fallbackPolicy]) {
    throw new Error(`ReferrerPolicy has unacceptable value. policy = ${fallbackPolicy}`);
  }

  const policy = `${opts.policy}, ${fallbackPolicy}`;

  resp.setHeader("Referrer-Policy", policy);
}

// TODO: https://www.npmjs.com/package/dont-sniff-mimetype

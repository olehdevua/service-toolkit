const X_FRAME_DIRECTIVES = ["SAMEORIGIN", "DENY"];
export function setXFrameOptions(resp, directive) {
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
export function setReferrerPolicy(resp, opts) {
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
//# sourceMappingURL=http.security.js.map
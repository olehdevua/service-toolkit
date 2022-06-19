export function waitForResponse(reqStream, url) {
    return new Promise((resolve, reject) => {
        reqStream.on("error", reject);
        reqStream.on("response", resolve);
        reqStream.on("timeout", () => {
            reqStream.destroy(new Error(`http request is timed out. url = ${url}`));
        });
    });
}
export function waitForWriteFinish(stream) {
    return new Promise((resolve, reject) => {
        stream.on("finish", resolve);
        stream.on("error", reject);
    });
}
//# sourceMappingURL=streams.js.map
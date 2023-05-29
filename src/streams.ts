import * as http from "node:http";
import { Writable } from "node:stream";

export function waitForResponse(
  reqStream: http.ClientRequest,
  url: string
): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    reqStream.on("error", reject);
    reqStream.on("response", resolve);
    reqStream.on("timeout", () => {
      reqStream.destroy(new Error(`http request is timed out. url = ${url}`));
    });
  });
}

export function waitForWriteFinish(stream: Writable) {
  return new Promise((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });
}

import http from "http";
import Negotiator from "negotiator";
import { HttpError } from "../errors.js";

export class SerializerManager {
  private serializers: Record<string, Serializer> = {};
  private negotiator: Negotiator;

  constructor(headers: http.IncomingHttpHeaders) {
    this.negotiator = new Negotiator({ headers: headers });
  }

  add(s: Serializer) {
    this.serializers[s.type] = s;
  }

  findSerializer(): Serializer {
    const types = this.negotiator.mediaTypes();

    for (const t of types) {
      const serializer = this.serializers[t];
      if (!serializer) continue;
      return serializer;
    }

    throw new HttpError("Not Acceptable", { httpStatus: 406 });
  }
}

export interface Serializer {
  type: string;
  serialize(body: Record<string, unknown>): string;
}

export class JSONSerializer implements Serializer {
  type = "application/json";

  serialize(body: Record<string, unknown>): string {
    return JSON.stringify(body);
  }
}

export class HtmlSerializer implements Serializer {
  type = "text/html";

  serialize(content: { body: string, title: string }): string {
    return createHtmlDocument(content.title, content.body);
  }
}

function createHtmlDocument(title: string, body: string) {
  return "<!DOCTYPE html>\n" +
    "<html lang=\"en\">\n" +
    "<head>\n" +
    "<meta charset=\"utf-8\">\n" +
    "<title>" + title + "</title>\n" +
    "</head>\n" +
    "<body>\n" +
    "<pre>" + body + "</pre>\n" +
    "</body>\n" +
    "</html>\n";
}

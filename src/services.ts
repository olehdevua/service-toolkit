import { Logger, Service, ServiceMeta } from "./index.js";
import * as perf from "./performance.js";

export class PerfService implements Service {
  constructor(
    private nextService: Service,
    private logger: Logger,
  ) {}

  async process(
    content: Record<string, unknown>,
    meta: ServiceMeta
  ): Promise<Record<string, unknown>> {
    const start = perf.now();

    const result = await this.nextService.process(content, meta);

    const range = perf.diff(start, perf.now());

    this.logger.verbose(`service take time. ms = ${range}`);

    return result;
  }

}

import * as perf from "./performance.js";
export class PerfService {
    nextService;
    logger;
    constructor(nextService, logger) {
        this.nextService = nextService;
        this.logger = logger;
    }
    async process(content, meta) {
        const start = perf.now();
        const result = await this.nextService.process(content, meta);
        const range = perf.diff(start, perf.now());
        this.logger.verbose(`service take time. ms = ${range}`);
        return result;
    }
}
//# sourceMappingURL=services.js.map
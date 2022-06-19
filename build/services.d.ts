import { Logger, Service, ServiceMeta } from "./index.js";
export declare class PerfService implements Service {
    private nextService;
    private logger;
    constructor(nextService: Service, logger: Logger);
    process(content: Record<string, unknown>, meta: ServiceMeta): Promise<Record<string, unknown>>;
}
//# sourceMappingURL=services.d.ts.map
// import { Logger, Service, ServiceMeta } from "./index.js";
// import * as perf from "./performance.js";

import { NotAuthenticated, NotAuthorized } from "./errors.js";
import { plainToInstance, ClassConstructor } from "class-transformer";
import { validateInstance } from "./validator.js";

export type ServiceMeta = {
  credentials: {
    token?: string;
  },
  context: {
    traceId: string;
    spanId: string;
  }
};

export type ServiceContent = Record<string, unknown>;

/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function */
export abstract class BaseService<InDTO extends object, OutDTO> {
  protected constructor(
    private inDTOClass: ClassConstructor<InDTO>,
  ) {}

  async validate(c: ServiceContent, _m: ServiceMeta): Promise<InDTO> {
    const inst = plainToInstance(this.inDTOClass, c);
    await validateInstance(inst, { message: `InDTO is invalid - ${this.constructor.name}` });
    return inst;
  }

  authenticate(_c: InDTO, m: ServiceMeta): Promise<boolean> {
    throw new NotAuthenticated("Not Authenticated", { params: m.credentials });
  }

  authorize(_c: InDTO, m: ServiceMeta): Promise<boolean> {
    throw new NotAuthorized("Not Authorized", { params: m.credentials });
  }

  async beforeEach(_c: ServiceContent, _m: ServiceMeta): Promise<void> {}

  abstract process(_c: InDTO, _m: ServiceMeta): Promise<OutDTO>

  async finalize(): Promise<void> {}

  async run(
    content: Record<string, unknown>,
    meta: ServiceMeta
  ): Promise<OutDTO> {
    try {
      await this.beforeEach(content, meta);
      const inDTO = await this.validate(content, meta);
      await this.authenticate(inDTO, meta);
      await this.authorize(inDTO, meta);
      return this.process(inDTO, meta);
    }
    finally {
      await this.finalize();
    }
  }
}
/* eslint-enable */

// export class PerfService implements Service {
//   constructor(
//     private nextService: Service,
//     private logger: Logger,
//   ) {}
//
//   async process(
//     content: Record<string, unknown>,
//     meta: ServiceMeta
//   ): Promise<Record<string, unknown>> {
//     const start = perf.now();
//
//     const result = await this.nextService.process(content, meta);
//
//     const range = perf.diff(start, perf.now());
//
//     this.logger.verbose(`service take time. ms = ${range}`);
//
//     return result;
//   }
//
// }

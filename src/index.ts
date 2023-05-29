export * from "./clients/index.js";
export * from "./errors.js";
export * from "./validator.js";
export * from "./services.js";
export * as h from "./http/index.js";
export * as crypto from "./crypto.js";
export * as perf from "./performance.js";
export * as swagger from "./swagger.js";
export * as utils from "./utils.js";

// export interface Model<T> {
//   update(patch: Record<string, unknown>): void;
//   getContent(): T;
// }
//
// export interface BaseModelContent {
//   id: string;
//   updated: Date;
//   created: Date;
// }
//
// export class ModelClass<T> {
//   protected Validator: { new(name: string): Validator<T> } = Validator<T>;
//
//   protected constructor(
//     protected content: T,
//   ) {}
//
//   static init(data: Record<string, unknown>) {
//     const content = new this.prototype.Validator(this.constructor.name)
//       .validate(data);
//
//     return new this(content);
//   }
//
//   public update(patch: Record<string, unknown>): void {
//     this.content = new this.Validator(this.constructor.name)
//       .validate({ ...this.content, ...patch });
//   }
//
//   public getContent(): Readonly<T> {
//     if (!this.content) {
//       throw new GeneralError("Model is not initialized", {
//         params: { model: this.constructor.name }
//       });
//     }
//     return { ...this.content };
//   }
// }

// Former "way", under discussion
//
// export type ServiceParams = {
//   content: Record<string, unknown>;
//   credentials?: {
//     // if there are permissions then don't do auth,
//     // otherwise do auth using token.
//     // WDYT about such approach?
//     permissions?: string[];
//     token: string;
//   };
// }

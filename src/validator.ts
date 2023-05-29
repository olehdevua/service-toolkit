import ValidatorJS from "validator";
import * as cv from "class-validator";
import { ValidationError } from "./errors.js";

type ValidationErrors = Record<string, ValidationErrorParams>;

type FieldMapperDepth =
  { type: 'range', from?: number, to?: number} |
  { type: 'level', l: number[] };


export type FieldMapper =
  { type: "string";   src: string[];  dst: string[]; } |
  { type: "regex";    src: RegExp;    dst: RegExp;  depth: { from: number; to: number} } |
  { type: "str_reg";  src: string;    dst: string;  depth: { from: number; to: number}; pos: "start" | "any" | "end" }

export class Mapper<T> {
  private fieldMappers: FieldMapper[] = [];

  add(f: FieldMapper) {
    this.fieldMappers.push(f);
  }
  // or
  addStr(srcPath: string, dstPath: string, _o: {}) {
    const src = srcPath.split(".");
    const dst = dstPath.split(".");
    this.fieldMappers.push({ type: "string", src, dst });
  }
  addRegex(path: RegExp, o: { from?: number, to?: number }) {
    this.fieldMappers.push({
      type: "regex",
      path,
      depth: [o.from ?? 0, o.to ?? Infinity]
    })

  }
  // src = 'r:<name>', exmp = 'r:Id$'
  addStrReg(path: string, dst: string, o: { from?: number, to?: number }) {
    this.fieldMappers.push({
      src,
      dst,
      depth: [o.from ?? 0, o.to ?? Infinity]
    })

  }

  clone(); // use-case: for "base" mappers (like mongo), to simplify reuse

  map(o: Record<string, unknown>): T {

  }

  private _map(o: Record<string, unknown>): T {

  }

}

// enum ValidatorType {
//   Init,
//   Number,
//   String
// }

// class PrototypeValidator2<T: ValidatorType> {
//
// }

export async function validateInstance(obj: object, o: {
  message: string,
  httpStatus?: number,
}) {
  const errors = await cv.validate(obj, { validationError: { target: false } });

  if (errors.length > 0) {
    const params = mapErrors(errors);
    throw new ValidationError(o.message, { params, httpStatus: o.httpStatus } );
  }
}

// export async function validatePlainObj<T extends object>(
//   classFn: ClassConstructor<T>,
//   obj: object,
//   o: {
//     message: string,
//     httpStatus?: number,
//   }
// ): Promise<T> {
//   const inst = plainToInstance(classFn, obj);
//   await validateInstance(inst, o);
//   return inst;
// }

function mapErrors(errs: cv.ValidationError[]) {
  const obj: Record<string, unknown> = {};

  for (const e of errs) {
    if (e.children && e.children.length > 0) {
      obj[e.property] = mapErrors(e.children);
    }
    else {
      obj[e.property] = {
        constraints: e.constraints,
        value: e.value,
      };
    }
  }

  return obj;
}

interface ValidationErrorParams {
  message: string;
  params?: Record<string, string | number>
  errors?: ValidationErrors
}

export abstract class Validator<T> {
  private errors: ValidationErrors  = {};
  private hasErrors = false;
  protected readonly content: T = {} as T;
  public name: string = "record";

  static jsonifyError() {
    (Error.prototype as any).toJSON = function() {
      return { message: this.message, params: this.params };
    };
  }

  protected setError(key: string | symbol | number, err: ValidationErrorParams): void {
    // Explicit set of "fields" for error object, because if you
    // pass an `Error` instance, its `message` property(not enumberable)
    // will be skipped by `JSON.stringify` function
    this.errors[key.toString()] = {
      message: err.message, params: err.params, errors: err.errors
    };
    this.hasErrors = true;
  }

  protected getError(key: string | symbol | number): ValidationErrorParams | void {
    return this.errors[key.toString()];
  }

  protected cleanError(key: string) {
    delete this.errors[key];
  }

  checkHasErrors(): boolean {
    return this.hasErrors;
  }

  getErrors(): ValidationErrors {
    return this.errors;
  }

  abstract check(_obj: Record<string, unknown>): void;

  validate(obj: Record<string, unknown>, o: { httpStatus?: number } = {}): T {
    this.check(obj);

    if (this.checkHasErrors())
      throw new ValidationError(`${this.name} is not valid`, {
        ...o,
        params: { attrs: this.getErrors() }
      });

    return this.content as T;
  }

  // checkNotDefined(val: unknown): ValidationResult {
  //   if (val === undefined) return { val: undefined };
  //   return { err: "Should not be defined", val: undefined } ;
  // }

  // TODO: it
  checkRecord(val: unknown, key: keyof T) {
    if (Object(val) === val) {
      this.content[key] = val as any;
    }
    this.setError(key, { message: "not a record" });
  }

  checkWithValidator(val: unknown, key: keyof T, validator: Validator<T[typeof key]>) {
    this.checkRecord(val, key);
    validator.check(val as Record<string, unknown>)
    if (validator.checkHasErrors()) {
      this.setError(key, {
        message: `entity is invalid`,
        params: { name: validator.name },
        errors: validator.errors
      });
    }
  }

  checkString(val: unknown, key: keyof T) {
    if (typeof val === "string") {
      this.content[key] = val as any;
    }
    this.setError(key, { message: "not a string" });
  }

  checkNumber(val: unknown, key: keyof T) {
    if (typeof val === "number" && !Number.isNaN(val)) {
      this.content[key] = val as any;
    }
    this.setError(key, { message: "not a number" });
  }

  castNumber(val: unknown, key: keyof T) {
    const castedVal = tryToNumber(val);
    return this.checkNumber(castedVal, key);
  }

  checkBoolean(val: unknown, key: keyof T) {
    if (typeof val === "boolean") {
      this.content[key] = val as any;
    }
    this.setError(key, { message: "not a boolean" });
  }

  castBoolean(val: unknown, key: keyof T) {
    const castedVal = tryToBoolean(val);
    return this.checkBoolean(castedVal, key);
  }

  checkBuffer(val: unknown, key: keyof T) {
    if (val instanceof Buffer) {
      this.content[key] = val as any;
    }
    this.setError(key, { message: "not a Buffer" });
  }

  checkDate(val: unknown, key: keyof T) {
    if (val instanceof Date) {
      this.content[key] = val as any;
    }
    this.setError(key, { message: "not a Date" });
  }

  castDate(val: unknown, key: keyof T) {
    const castedDate = tryToDate(val);
    this.checkDate(castedDate, key);
  }

  checkEmail(val: unknown, key: keyof T) {
    this.checkString(val, key);
    if (this.getError(key)) return;

    if ((ValidatorJS as any).isEmail(val as string)) {
      this.content[key] = val as any;
    }
    this.setError(key, { message: "not an email" });
  }

  checkUUIDString(val: unknown, key: keyof T) {
    this.checkString(val, key);
    if (this.getError(key)) return;

    if ((ValidatorJS as any).isUUID(val as string)) {
      this.content[key] = val as any;
    }
    this.setError(key, { message: "not an uuid" });
  }

  checkRange(
    val: unknown, key: keyof T, opts: { min?: number, max?: number }
  ) {
    this.checkNumber(val, key);
    if (this.getError(key)) return;

    const num = val as number;

    if (opts.min && num < opts.min) {
      this.setError(key, { message: "less than min", params: { min: opts.min } });
      return;
    }
    if (opts.max && num > opts.max) {
      this.setError(key, { message: "more than max", params: { min: opts.max } });
      return;
    }

    this.content[key] = val as any;
  }

  castRange(
    val: unknown, key: keyof T, opts: { min?: number, max?: number }
  ) {
    const castedVal = tryToNumber(val);
    this.checkRange(castedVal, key, opts);
  }

  checkPassword(val: unknown, key: keyof T, o: { format: RegExp }) {
    this.checkString(val, key);
    if (this.getError(key)) return;

    if (o.format.test(val as string)) {
      this.content[key] = val as any;
    }

    this.setError(key, {
      message: "not a password",
      params: { format: o.format.toString() }
    });
  }
}

// function tryToString(val: unknown): unknown {
//   return typeof val === "string" ? val : val + "";
// }

function tryToNumber(val: unknown): unknown {
  if (typeof val === "number") return val;
  const valStr = val + "";

  const num = Number.parseInt(valStr, 10);
  if (!Number.isNaN(num)) return num;

  const numFloat = Number.parseFloat(valStr);
  if (!Number.isNaN(num)) return numFloat;

  return val;
}

function tryToBoolean(val: unknown): unknown {
  if (typeof val === "boolean") return val;
  if (val === "true") return true;
  if (val === "false") return false;
  return val;
}

function tryToDate(val: unknown): unknown {
  if (typeof val === "number") {
    return new Date(val);
  }
  if (typeof val === "string") {
    // const dateVal = new Date(val);
    // if (!Number.isNaN(dateVal.valueOf())) return dateVal;
    const dateNum = Date.parse(val);
    if (!Number.isNaN(dateNum)) return new Date(dateNum);
  }
  return val;
}

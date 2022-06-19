import ValidatorJS from "validator";

type ValidationErrors = Record<string, ValidationErrorParams>;

interface ValidationErrorParams {
  message: string;
  params?: Record<string, string | number>
}

export class Validator {
  private errors: ValidationErrors  = {};
  public _hasErrors = false;

  static jsonifyError() {
    (Error.prototype as any).toJSON = function() {
      return { message: this.message, params: this.params };
    };
  }

  protected setError(key: string, err: ValidationErrorParams): void {
    // Explicit set of "fields" for error object, because if you
    // pass an `Error` instance, its `message` property(not enumberable)
    // will be scipped by `JSON.stringify` function 
    this.errors[key] = { message: err.message, params: err.params };
    this._hasErrors = true;
  }

  protected getError(key: string): ValidationErrorParams {
    return this.errors[key];
  }

  protected cleanError(key: string) {
    delete this.errors[key];
  }

  checkHasErrors(): boolean {
    return this._hasErrors;
  }

  getErrors(): ValidationErrors {
    return this.errors;
  }

  // checkNotDefined(val: unknown): ValidationResult {
  //   if (val === undefined) return { val: undefined };
  //   return { err: "Should not be defined", val: undefined } ;
  // }

  checkString(val: unknown, key: string): string | void {
    if (typeof val === "string") return val;
    this.setError(key, { message: "not a string" });
  }

  checkNumber(val: unknown, key: string): number | void {
    if (typeof val === "number" && !Number.isNaN(val)) return val;
    this.setError(key, { message: "not a number" });
  }

  castNumber(val: unknown, key: string): number | void {
    const castedVal = tryToNumber(val);
    return this.checkNumber(castedVal, key);
  }

  checkBoolean(val: unknown, key: string): boolean | void {
    if (typeof val === "boolean") return val;
    this.setError(key, { message: "not a boolean" });
  }

  castBoolean(val: unknown, key: string): boolean | void {
    const castedVal = tryToBoolean(val);
    return this.checkBoolean(castedVal, key);
  }

  checkBuffer(val: unknown, key: string): Buffer | void {
    if (val instanceof Buffer) return val;
    this.setError(key, { message: "not a Buffer" });
  }

  checkDate(val: unknown, key: string): Date | void {
    if (val instanceof Date) return val;
    this.setError(key, { message: "not a Date" });
  }

  castDate(val: unknown, key: string): Date | void {
    if (val instanceof Date) return val;

    if (typeof val === "string" || typeof val === "number") {
      const dateVal = new Date(val);
      if (!Number.isNaN(dateVal.valueOf())) return dateVal;
    }

    this.setError(key, { message: "not a Date" });
  }

  checkEmail(val: unknown, key: string): string | void {
    const strRes = this.checkString(val, key);
    if (!strRes) return;

    if ((ValidatorJS as any).isEmail(strRes)) {
      return strRes;
    }
    this.setError(key, { message: "not an email" });
  }

  checkUUIDString(val: unknown, key: string): string | void {
    const stringResult = this.checkString(val, key);
    if (!stringResult) return;

    if ((ValidatorJS as any).isUUID(stringResult)) {
      return stringResult;
    }
    this.setError(key, { message: "not an uuid" });
  }

  checkRange(
    val: unknown, key: string, opts: { min?: number, max?: number }
  ): number | void {
    const numRes = this.checkNumber(val, key);
    if (!numRes) return;

    if (opts.min && numRes < opts.min) {
      this.setError(key, { message: "less than min", params: { min: opts.min } });
      return;
    }
    if (opts.max && numRes > opts.max) {
      this.setError(key, { message: "more than max", params: { min: opts.max } });
      return;
    }

    return numRes;
  }

  castRange(
    val: unknown, key: string, opts: { min?: number, max?: number }
  ): number | void {
    const castedVal = tryToNumber(val);
    this.checkRange(castedVal, key, opts);
  }

  checkPassword(val: unknown, key: string): string | void {
    const strRes = this.checkString(val, key);
    if (!strRes) return;

    if (/[a-zA-Z0-9]{8}/.test(strRes)) return strRes;

    this.setError(key, { message: "not a password", params: { format: "[a-zA-Z0-9]" } });
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

/// <reference types="node" resolution-mode="require"/>
declare type ValidationErrors = Record<string, ValidationErrorParams>;
interface ValidationErrorParams {
    message: string;
    params?: Record<string, string | number>;
}
export declare class Validator {
    private errors;
    _hasErrors: boolean;
    static jsonifyError(): void;
    protected setError(key: string, err: ValidationErrorParams): void;
    protected getError(key: string): ValidationErrorParams;
    protected cleanError(key: string): void;
    checkHasErrors(): boolean;
    getErrors(): ValidationErrors;
    checkString(val: unknown, key: string): string | void;
    checkNumber(val: unknown, key: string): number | void;
    castNumber(val: unknown, key: string): number | void;
    checkBoolean(val: unknown, key: string): boolean | void;
    castBoolean(val: unknown, key: string): boolean | void;
    checkBuffer(val: unknown, key: string): Buffer | void;
    checkDate(val: unknown, key: string): Date | void;
    castDate(val: unknown, key: string): Date | void;
    checkEmail(val: unknown, key: string): string | void;
    checkUUIDString(val: unknown, key: string): string | void;
    checkRange(val: unknown, key: string, opts: {
        min?: number;
        max?: number;
    }): number | void;
    castRange(val: unknown, key: string, opts: {
        min?: number;
        max?: number;
    }): number | void;
    checkPassword(val: unknown, key: string): string | void;
}
export {};
//# sourceMappingURL=validator.d.ts.map
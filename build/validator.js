import ValidatorJS from "validator";
export class Validator {
    errors = {};
    _hasErrors = false;
    static jsonifyError() {
        Error.prototype.toJSON = function () {
            return { message: this.message, params: this.params };
        };
    }
    setError(key, err) {
        this.errors[key] = { message: err.message, params: err.params };
        this._hasErrors = true;
    }
    getError(key) {
        return this.errors[key];
    }
    cleanError(key) {
        delete this.errors[key];
    }
    checkHasErrors() {
        return this._hasErrors;
    }
    getErrors() {
        return this.errors;
    }
    checkString(val, key) {
        if (typeof val === "string")
            return val;
        this.setError(key, { message: "not a string" });
    }
    checkNumber(val, key) {
        if (typeof val === "number" && !Number.isNaN(val))
            return val;
        this.setError(key, { message: "not a number" });
    }
    castNumber(val, key) {
        const castedVal = tryToNumber(val);
        return this.checkNumber(castedVal, key);
    }
    checkBoolean(val, key) {
        if (typeof val === "boolean")
            return val;
        this.setError(key, { message: "not a boolean" });
    }
    castBoolean(val, key) {
        const castedVal = tryToBoolean(val);
        return this.checkBoolean(castedVal, key);
    }
    checkBuffer(val, key) {
        if (val instanceof Buffer)
            return val;
        this.setError(key, { message: "not a Buffer" });
    }
    checkDate(val, key) {
        if (val instanceof Date)
            return val;
        this.setError(key, { message: "not a Date" });
    }
    castDate(val, key) {
        if (val instanceof Date)
            return val;
        if (typeof val === "string" || typeof val === "number") {
            const dateVal = new Date(val);
            if (!Number.isNaN(dateVal.valueOf()))
                return dateVal;
        }
        this.setError(key, { message: "not a Date" });
    }
    checkEmail(val, key) {
        const strRes = this.checkString(val, key);
        if (!strRes)
            return;
        if (ValidatorJS.isEmail(strRes)) {
            return strRes;
        }
        this.setError(key, { message: "not an email" });
    }
    checkUUIDString(val, key) {
        const stringResult = this.checkString(val, key);
        if (!stringResult)
            return;
        if (ValidatorJS.isUUID(stringResult)) {
            return stringResult;
        }
        this.setError(key, { message: "not an uuid" });
    }
    checkRange(val, key, opts) {
        const numRes = this.checkNumber(val, key);
        if (!numRes)
            return;
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
    castRange(val, key, opts) {
        const castedVal = tryToNumber(val);
        this.checkRange(castedVal, key, opts);
    }
    checkPassword(val, key) {
        const strRes = this.checkString(val, key);
        if (!strRes)
            return;
        if (/[a-zA-Z0-9]{8}/.test(strRes))
            return strRes;
        this.setError(key, { message: "not a password", params: { format: "[a-zA-Z0-9]" } });
    }
}
function tryToNumber(val) {
    if (typeof val === "number")
        return val;
    const valStr = val + "";
    const num = Number.parseInt(valStr, 10);
    if (!Number.isNaN(num))
        return num;
    const numFloat = Number.parseFloat(valStr);
    if (!Number.isNaN(num))
        return numFloat;
    return val;
}
function tryToBoolean(val) {
    if (typeof val === "boolean")
        return val;
    if (val === "true")
        return true;
    if (val === "false")
        return false;
    return val;
}
//# sourceMappingURL=validator.js.map
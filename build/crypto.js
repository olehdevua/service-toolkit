import * as crypto from "crypto";
export async function encodePassword(password) {
    const salt = await randomBuffer(32);
    const passwordHash = await new Promise((resolve, reject) => {
        return crypto.pbkdf2(password, salt, 100000, 64, "sha256", (err, buf) => {
            return err ? reject(err) : resolve(buf);
        });
    });
    return [passwordHash, salt];
}
export async function generateTokens() {
    return Promise.all([randomBuffer(16), randomBuffer(16)]);
}
function randomBuffer(len) {
    return new Promise((resolve, reject) => {
        crypto.randomBytes(len, (err, buf) => {
            err ? reject(err) : resolve(buf);
        });
    });
}
//# sourceMappingURL=crypto.js.map
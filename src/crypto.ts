import * as crypto from "crypto";

export async function encodePassword(
  password: string
): Promise<[Buffer, Buffer]> {
  const salt: Buffer = await randomBuffer(32);

  const passwordHash: Buffer = await new Promise((resolve, reject) => {
    return crypto.pbkdf2(password, salt, 100000, 64, "sha256", (err, buf) => {
      return err ? reject(err) : resolve(buf);
    });
  });

  return [ passwordHash, salt ];
}

export async function generateTokens(): Promise<[Buffer, Buffer]> {
  // return [ accessToken, refreshToken ];
  return Promise.all([ randomBuffer(16), randomBuffer(16) ]);
}

export function randomBuffer(len: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.randomBytes(len, (err, buf) => {
      err ? reject(err) : resolve(buf);
    });
  });
}

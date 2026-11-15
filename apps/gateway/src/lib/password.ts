import bcrypt from "bcryptjs";
import passwordHash from "password-hash";

export function hashPasswordSync(password: string): string {
  if (!password) return "";
  return bcrypt.hashSync(password, 10);
}

export async function verifyPasswordAsync(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  if (hash.startsWith("sha1$") || hash.startsWith("sha256$")) {
    return passwordHash.verify(password, hash);
  }
  return bcrypt.compare(password, hash);
}

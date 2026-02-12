import {existsSync, readFileSync} from "fs";

export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} not set in .env`);
  }
  return value;
}

export function loadPrivateKey(): string {
  const key = process.env.PRIVATE_KEY;
  const path = process.env.PRIVATE_KEY_PATH;

  if (key) {
    return key.replace(/\\n/g, "\n");
  }

  if (path && existsSync(path)) {
    return readFileSync(path, "utf-8");
  }

  throw new Error("set PRIVATE_KEY or PRIVATE_KEY_PATH in your .env");
}

export function loadBundle(inputPath: string): unknown {
  return JSON.parse(readFileSync(inputPath, "utf-8"));
}

import {existsSync, readFileSync} from "fs";

import type {BundleLike} from "./types.js";

export function cloneBundle(bundle: BundleLike): BundleLike {
  return JSON.parse(JSON.stringify(bundle)) as BundleLike;
}

export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} not set in .env`);
  }
  return value;
}

export function loadPrivateKey(): string {
  const key = process.env.PRESCRIBE_PRIVATE_KEY;
  const path = process.env.PRESCRIBE_PRIVATE_KEY_PATH;

  if (key) {
    return key.replace(/\\n/g, "\n");
  }

  if (path && existsSync(path)) {
    return readFileSync(path, "utf-8");
  }

  throw new Error("set PRESCRIBE_PRIVATE_KEY or PRESCRIBE_PRIVATE_KEY_PATH in your .env");
}

export function loadBundle(inputPath: string): unknown {
  return JSON.parse(readFileSync(inputPath, "utf-8"));
}

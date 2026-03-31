import {mkdirSync, writeFileSync} from "fs";

export function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} not set in .env`);
  }
  return value;
}

export function saveBundle(
  prefix: string,
  bundle: Record<string, unknown>,
  saveDir: string,
  nhsNumber?: string
): void {
  mkdirSync(saveDir, {recursive: true});

  const number = nhsNumber ?? "unknown-nhs-number";
  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\..+$/, "");

  const filePath = `${saveDir}/${prefix}_${ts}_nhs-num-${number}.json`;
  writeFileSync(filePath, JSON.stringify(bundle, null, 2), "utf-8");
  console.log(filePath);
}

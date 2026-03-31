import {createSign} from "crypto";

import {preparePrescription} from "./prepare.js";
import type {SignResult} from "./types.js";

export function signDigest(
  digest: string,
  privateKey: string,
  algorithm = "RSA-SHA1"
): string {
  const digestBytes = Buffer.from(digest, "base64");
  const signer = createSign(algorithm);
  signer.update(digestBytes);
  return signer.sign(privateKey, "base64");
}

export async function prepareAndSign(
  host: string,
  token: string,
  bundle: unknown,
  privateKey: string,
  urid?: string,
  algorithm?: string
): Promise<SignResult> {
  const {digest, timestamp} = await preparePrescription(host, token, bundle, urid);
  const signature = signDigest(digest, privateKey, algorithm);
  return {digest, signature, timestamp};
}

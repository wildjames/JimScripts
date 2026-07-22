import {createSign} from "crypto";

import {preparePrescription} from "./prepare.js";
import type {SignResult} from "./types.js";

/**
 * Detect the signing algorithm from the $prepare digest XML.
 * The digest is a base64-encoded <SignedInfo> which contains a <SignatureMethod Algorithm="..."> element.
 */
export function detectAlgorithmFromDigest(digest: string): string {
  const xml = Buffer.from(digest, "base64").toString("utf-8");
  const match = xml.match(/SignatureMethod Algorithm="([^"]+)"/);
  if (!match) return "RSA-SHA1";
  const uri = match[1];
  if (uri.includes("rsa-sha256") || uri.includes("sha256")) return "RSA-SHA256";
  if (uri.includes("rsa-sha512") || uri.includes("sha512")) return "RSA-SHA512";
  return "RSA-SHA1";
}

export function signDigest(
  digest: string,
  privateKey: string,
  algorithm?: string
): string {
  const algo = algorithm ?? detectAlgorithmFromDigest(digest);
  // Per NHS guidance Step 2: "Sign the base64 encoded signed info block"
  // Sign the raw bytes from $prepare as-is (includes xmlns on <SignedInfo>).
  // The xmlns is only stripped later when embedding in the <Signature> wrapper (Step 3).
  const digestBytes = Buffer.from(digest, "base64");
  const signer = createSign(algo);
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

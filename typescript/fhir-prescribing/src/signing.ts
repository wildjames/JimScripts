import {createSign} from "crypto";

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

import type {BundleLike} from "./types.js";

export function cloneBundle(bundle: BundleLike): BundleLike {
  return JSON.parse(JSON.stringify(bundle)) as BundleLike;
}

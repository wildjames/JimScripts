import { sendDispensingRequest, type DispensingRequestResult } from "./http.js";

export interface ReleaseTaskOptions {
  host: string;
  token: string;
  body: unknown;
  mode?: "attended" | "unattended";
  urid?: string;
  requestSaveDir?: string;
}

export async function releaseTask(
  options: ReleaseTaskOptions,
): Promise<DispensingRequestResult> {
  const mode = options.mode ?? "attended";
  const endpoint =
    mode === "unattended" ? "Task/$release-unattended" : "Task/$release";

  const result = await sendDispensingRequest({
    host: options.host,
    token: options.token,
    endpoint,
    body: options.body,
    urid: mode === "attended" ? options.urid : undefined,
    requestSaveDir: options.requestSaveDir,
    action: "release",
  });

  return result;
}

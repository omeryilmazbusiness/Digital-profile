import {
  ApiError,
  createApiClient,
  CSRF_HEADER,
  type Problem,
  type Schemas,
  toProblem,
  unwrap,
} from "@/lib/api/client";

export { ApiError, unwrap };
export type { Schemas };

const AUTH_PATH = "/api/v1/auth/";
/** Raised when the session can't be renewed; the panel then asks to sign in again. */
export const SIGNED_OUT_EVENT = "admin:signed-out";

let refreshing: Promise<boolean> | undefined;

/**
 * Renews the session with the refresh cookie. Concurrent callers share one request: the
 * refresh token rotates, so a second parallel refresh would be rejected as a replay.
 */
export function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/v1/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
    headers: { [CSRF_HEADER]: "1" },
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = undefined;
    });
  return refreshing;
}

function signedOut() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
}

/** fetch that renews an expired access token once and replays the request. */
export async function sessionFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const request = new Request(input, init);
  const replay = request.clone();
  const response = await fetch(request);
  if (response.status !== 401 || new URL(request.url).pathname.startsWith(AUTH_PATH)) {
    return response;
  }
  if (!(await refreshSession())) {
    signedOut();
    return response;
  }
  const retried = await fetch(replay);
  if (retried.status === 401) signedOut();
  return retried;
}

/** The admin panel's API client: same origin, session cookies, CSRF header. */
export const api = createApiClient({ baseUrl: "", fetch: sessionFetch });

/** Field errors of a 400/422 problem, keyed by the API's field path. */
export function fieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || (error.status !== 400 && error.status !== 422)) return {};
  return Object.fromEntries((error.problem.errors ?? []).map((e) => [e.field, e.message]));
}

export interface UploadOptions {
  /** 0–1, as bytes are sent. */
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/**
 * POSTs or PUTs a multipart form with upload progress, which fetch can't report. Renews the
 * session once on 401 like sessionFetch.
 */
export async function upload<T>(
  method: "POST" | "PUT",
  path: string,
  form: FormData,
  options: UploadOptions = {},
): Promise<T> {
  let result = await send(method, path, form, options);
  if (result.status === 401) {
    if (!(await refreshSession())) {
      signedOut();
    } else {
      result = await send(method, path, form, options);
      if (result.status === 401) signedOut();
    }
  }
  if (result.status >= 200 && result.status < 300) return result.body as T;
  const response = new Response(null, { status: result.status, statusText: result.statusText });
  throw new ApiError(toProblem(result.body, response) as Problem, result.body);
}

interface XhrResult {
  status: number;
  statusText: string;
  body: unknown;
}

function send(
  method: string,
  path: string,
  form: FormData,
  { onProgress, signal }: UploadOptions,
): Promise<XhrResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, path);
    xhr.withCredentials = true;
    xhr.responseType = "json";
    xhr.setRequestHeader(CSRF_HEADER, "1");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () =>
      resolve({ status: xhr.status, statusText: xhr.statusText, body: xhr.response as unknown });
    xhr.onerror = () => reject(new TypeError("Network request failed"));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}

/** Human message for a failed request: network, session, size or the API's own words. */
export function errorKind(
  error: unknown,
): "network" | "session" | "tooLarge" | "rateLimited" | "other" {
  if (error instanceof TypeError) return "network";
  if (error instanceof ApiError) {
    if (error.status === 401) return "session";
    if (error.status === 413) return "tooLarge";
    if (error.status === 429) return "rateLimited";
  }
  return "other";
}

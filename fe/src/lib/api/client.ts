import createClient from "openapi-fetch";

import type { components, paths } from "./schema.gen";

export type Problem = components["schemas"]["Problem"];
export type Schemas = components["schemas"];

export type ApiClient = ReturnType<typeof createApiClient>;

export interface ApiClientOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  headers?: HeadersInit;
}

/**
 * The API rejects state-changing auth/admin requests without this header (CSRF defence);
 * cross-site forms cannot set it, and cross-origin scripts are stopped by CORS.
 */
export const CSRF_HEADER = "X-CSRF-Protection";

/**
 * Session tokens live in HttpOnly cookies, so requests must include credentials and the
 * client never handles tokens itself.
 */
export function createApiClient({ baseUrl, fetch, headers }: ApiClientOptions) {
  const merged = new Headers(headers);
  merged.set(CSRF_HEADER, "1");
  return createClient<paths>({ baseUrl, fetch, headers: merged, credentials: "include" });
}

/** Error thrown for every non-2xx response, always carrying an RFC 9457 problem. */
export class ApiError extends Error {
  readonly problem: Problem;
  /** Original response body; may be a typed non-problem payload (e.g. a 503 health report). */
  readonly body: unknown;

  constructor(problem: Problem, body: unknown) {
    super(problem.detail ?? problem.title);
    this.name = "ApiError";
    this.problem = problem;
    this.body = body;
  }

  get status(): number {
    return this.problem.status;
  }
}

export function isProblem(value: unknown): value is Problem {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.type === "string" && typeof v.title === "string" && typeof v.status === "number";
}

export function toProblem(body: unknown, response: Response): Problem {
  if (isProblem(body)) return body;
  return {
    type: "about:blank",
    title: response.statusText || `HTTP ${response.status}`,
    status: response.status,
    requestId: response.headers.get("X-Request-Id") ?? undefined,
  };
}

interface FetchResult {
  data?: unknown;
  error?: unknown;
  response: Response;
}

/** Returns the success payload or throws an ApiError with a normalised problem. */
export async function unwrap<R extends FetchResult>(
  request: Promise<R>,
): Promise<NonNullable<R["data"]>> {
  const { data, error, response } = await request;
  if (error !== undefined || !response.ok) {
    throw new ApiError(toProblem(error, response), error);
  }
  return data as NonNullable<R["data"]>;
}

import { describe, expect, it, vi } from "vitest";

import { ApiError, CSRF_HEADER, createApiClient, isProblem, unwrap } from "./client";

function jsonResponse(body: unknown, init: ResponseInit & { contentType?: string } = {}) {
  const { contentType = "application/json", ...rest } = init;
  return new Response(JSON.stringify(body), {
    ...rest,
    headers: { "Content-Type": contentType, ...rest.headers },
  });
}

function clientReturning(response: Response) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => response);
  return { fetch, api: createApiClient({ baseUrl: "http://api.test", fetch }) };
}

describe("createApiClient", () => {
  it("calls the typed endpoint and returns data", async () => {
    const { api, fetch } = clientReturning(jsonResponse({ status: "up", version: "1.0.0" }));

    const report = await unwrap(api.GET("/healthz"));

    expect(report).toEqual({ status: "up", version: "1.0.0" });
    const request = fetch.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("http://api.test/healthz");
    expect(request.method).toBe("GET");
  });

  it("sends cookies and the CSRF header on every request", async () => {
    const { api, fetch } = clientReturning(new Response(null, { status: 204 }));

    await api.POST("/api/v1/auth/logout");

    const request = fetch.mock.calls[0]?.[0] as Request;
    expect(request.credentials).toBe("include");
    expect(request.headers.get(CSRF_HEADER)).toBe("1");
  });
});

describe("unwrap", () => {
  it("throws ApiError carrying the server problem", async () => {
    const problem = {
      type: "about:blank",
      title: "Not Found",
      status: 404,
      detail: "no such route",
      requestId: "abc",
    };
    const { api } = clientReturning(
      jsonResponse(problem, { status: 404, contentType: "application/problem+json" }),
    );

    const error = await unwrap(api.GET("/healthz")).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).problem).toEqual(problem);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).message).toBe("no such route");
  });

  it("normalises a non-problem error body and keeps the original payload", async () => {
    const report = { status: "down", version: "1.0.0", checks: [{ name: "db", status: "down" }] };
    const { api } = clientReturning(
      jsonResponse(report, {
        status: 503,
        statusText: "Service Unavailable",
        headers: { "X-Request-Id": "req-1" },
      }),
    );

    const error = (await unwrap(api.GET("/readyz")).catch((e: unknown) => e)) as ApiError;

    expect(error).toBeInstanceOf(ApiError);
    expect(error.problem).toEqual({
      type: "about:blank",
      title: "Service Unavailable",
      status: 503,
      requestId: "req-1",
    });
    expect(error.body).toEqual(report);
  });

  it("propagates network failures untouched", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => {
      throw new TypeError("network down");
    });
    const api = createApiClient({ baseUrl: "http://api.test", fetch });

    await expect(unwrap(api.GET("/healthz"))).rejects.toThrow(TypeError);
  });
});

describe("isProblem", () => {
  it.each([
    [{ type: "about:blank", title: "x", status: 400 }, true],
    [{ title: "x", status: 400 }, false],
    [{ type: "about:blank", title: "x", status: "400" }, false],
    [null, false],
    ["oops", false],
  ])("isProblem(%j) === %s", (value, expected) => {
    expect(isProblem(value)).toBe(expected);
  });
});

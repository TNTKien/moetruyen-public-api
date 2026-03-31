import { describe, expect, it } from "bun:test";

process.env.NODE_ENV = "test";
process.env.PORT = "8787";
process.env.DATABASE_URL = "postgres://test:test@127.0.0.1:5432/test";
process.env.API_BASE_URL = "http://localhost:8787";
process.env.PUBLIC_SITE_URL = "https://example.com";
process.env.COVER_BASE_URL = "https://moetruyen.net";
process.env.CHAPTER_CDN_BASE_URL = "https://i.moetruyen.net";
process.env.ALLOWED_ORIGINS = "https://example.com";
process.env.LOG_LEVEL = "info";

const { app } = await import("../src/app.js");

describe("public api app surface", () => {
  it("returns the health payload", async () => {
    const response = await app.request("http://local/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      success: true,
      data: {
        status: "ok",
        service: "moetruyen-public-api",
      },
    });
  });

  it("redirects the root path to docs", async () => {
    const response = await app.request("http://local/", {
      redirect: "manual",
    });

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/docs");
  });

  it("serves the favicon asset", async () => {
    const response = await app.request("http://local/favicon.ico");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/x-icon");
  });

  it("applies CORS headers for allowed origins", async () => {
    const response = await app.request("http://local/health", {
      headers: {
        Origin: "https://example.com",
      },
    });

    expect(response.headers.get("access-control-allow-origin")).toBe("https://example.com");
    expect(response.headers.get("access-control-expose-headers")).toContain("X-Request-Id");
  });

  it("returns the OpenAPI document with v2 routes only", async () => {
    const response = await app.request("http://local/openapi.json");
    const body = (await response.json()) as { info?: { title?: string }; paths?: Record<string, unknown> };
    const paths = Object.keys(body.paths ?? {});

    expect(response.status).toBe(200);
    expect(body.info?.title).toBe("Moetruyen Public API");
    expect(paths.some((path) => path.startsWith("/v2/"))).toBe(true);
    expect(paths.some((path) => path.startsWith("/v1/"))).toBe(false);
  });

  it("returns the Scalar docs html", async () => {
    const response = await app.request("http://local/docs");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("Moetruyen Public API v0.2.0 Docs");
  });

  it("returns 404 for removed v1 routes", async () => {
    const response = await app.request("http://local/v1/manga?limit=1");
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toMatchObject({
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    });
  });
});

import { describe, expect, it } from "bun:test";
import { Hono } from "hono";

process.env.NODE_ENV ??= "test";
process.env.APITALLY_CLIENT_ID ??= "";

const { globalRateLimitMiddleware, searchRateLimitMiddleware } = await import("../src/lib/rate-limit.ts");
const { setupMonitoring } = await import("../src/lib/monitoring.ts");

describe("operations middleware configuration", () => {
  it("disables rate limiting in test mode", () => {
    expect(globalRateLimitMiddleware).toBeNull();
    expect(searchRateLimitMiddleware).toBeNull();
  });

  it("skips monitoring setup when Apitally is not configured", async () => {
    const app = new Hono();

    await expect(setupMonitoring(app)).resolves.toBeUndefined();
  });
});

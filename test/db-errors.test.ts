import { describe, expect, it } from "bun:test";

const { normalizeDbError } = await import("../src/lib/db-errors.js");

describe("database error normalization", () => {
  it("maps unique violations to conflict app errors", () => {
    const error = normalizeDbError({
      cause: {
        code: "23505",
        detail: "Key already exists",
        constraint: "users_email_key",
      },
    });

    expect(error).not.toBeNull();
    expect(error).toMatchObject({
      code: "DB_CONFLICT",
      status: 409,
      message: "Resource already exists",
    });
  });

  it("maps connection failures to service unavailable", () => {
    const error = normalizeDbError(new Error("Connection terminated unexpectedly"));

    expect(error).not.toBeNull();
    expect(error).toMatchObject({
      code: "DB_UNAVAILABLE",
      status: 503,
    });
  });

  it("ignores unrelated application errors", () => {
    expect(normalizeDbError(new Error("Something else happened"))).toBeNull();
  });
});

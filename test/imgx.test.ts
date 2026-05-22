import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";

const {
  createImgxPageGrant,
  deriveImgxKey,
  imageIdFromStorageKey,
  unwrapDecodeKeyFromGrant,
} = await import("../src/lib/imgx.js");

describe("IMGX helpers", () => {
  it("creates wrapped page grants that unwrap to the per-image decode key", () => {
    const storageKey = "chapters/manga-873/ch-52/001_ysXot.js";
    const imgxSecret = "imgx-secret";
    const decodeKey = deriveImgxKey(imageIdFromStorageKey(storageKey), imgxSecret);

    const grant = createImgxPageGrant({
      storageKey,
      sessionId: "test-session",
      imgxSecret,
      hmacSecret: "hmac-secret",
      ttlMs: 60_000,
      now: 1_779_440_000_000,
      randomBytes: (byteLength) => Buffer.alloc(byteLength, 0xab),
    });

    expect(grant).toMatchObject({
      version: 2,
      algorithm: "IMGX-HMAC-SHA256-v2",
      imageId: createHash("sha256").update(storageKey).digest("hex").slice(0, 32),
      issuedAt: 1_779_440_000_000,
      expiresAt: 1_779_440_060_000,
    });
    expect(grant).not.toHaveProperty("decodeKey");
    expect(grant.wrappedDecodeKey).toBeString();

    const unwrapped = unwrapDecodeKeyFromGrant({ grant, storageKey });

    expect(Buffer.from(unwrapped).equals(decodeKey)).toBe(true);
  });

  it("rejects wrapped grants when the storage key does not match", () => {
    const grant = createImgxPageGrant({
      storageKey: "chapters/manga-873/ch-52/001_ysXot.js",
      sessionId: "test-session",
      imgxSecret: "imgx-secret",
      hmacSecret: "hmac-secret",
      ttlMs: 60_000,
      now: 1_779_440_000_000,
      randomBytes: (byteLength) => Buffer.alloc(byteLength, 0xab),
    });

    expect(() =>
      unwrapDecodeKeyFromGrant({
        grant,
        storageKey: "chapters/manga-873/ch-52/002_ysXot.js",
      }),
    ).toThrow("IMGX wrapped decode key hash mismatch");
  });
});

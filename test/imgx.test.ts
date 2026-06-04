import { describe, expect, it } from "bun:test";
import { createHash } from "node:crypto";

const {
  createImgxPageGrant,
  deriveImgxContentKey,
  deriveImgxKey,
  imageIdFromStorageKey,
  unwrapContentKeyFromGrant,
  unwrapDecodeKeyFromGrant,
} = await import("../src/lib/imgx.js");

describe("IMGX helpers", () => {
  it("creates dual codec page grants that unwrap to legacy and v3 content keys", () => {
    const storageKey = "chapters/manga-873/ch-52/001_ysXot.js";
    const imgxSecret = "imgx-secret";
    const imageId = imageIdFromStorageKey(storageKey);
    const decodeKey = deriveImgxKey(imageId, imgxSecret);
    const contentKey = deriveImgxContentKey({ imageId, secret: imgxSecret, storageKey });

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
      version: 1,
      algorithm: "IMGX-GRANT-WRAP-v1",
      codecVersions: [2, 3],
      defaultCodecVersion: 3,
      contentAlgorithm: "IMGX-AES-256-GCM-HKDF-v3",
      legacyAlgorithm: "IMGX-HMAC-SHA256-v2",
      imageId: createHash("sha256").update(storageKey).digest("hex").slice(0, 32),
      issuedAt: 1_779_440_000_000,
      expiresAt: 1_779_440_060_000,
    });
    expect(grant).not.toHaveProperty("decodeKey");
    expect(grant).not.toHaveProperty("contentKey");
    expect(grant.wrappedDecodeKey).toBeString();
    expect(grant.wrappedContentKey).toBeString();

    const unwrappedDecodeKey = unwrapDecodeKeyFromGrant({ grant, storageKey });
    const unwrappedContentKey = unwrapContentKeyFromGrant({ grant, storageKey });

    expect(Buffer.from(unwrappedDecodeKey).equals(decodeKey)).toBe(true);
    expect(Buffer.from(unwrappedContentKey).equals(contentKey)).toBe(true);
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

    expect(() =>
      unwrapContentKeyFromGrant({
        grant,
        storageKey: "chapters/manga-873/ch-52/002_ysXot.js",
      }),
    ).toThrow("IMGX wrapped content key hash mismatch");
  });
});

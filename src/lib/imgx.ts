import { createHash, createHmac, hkdfSync, randomBytes as cryptoRandomBytes } from "node:crypto";

export const IMGX_LEGACY_VERSION = 2;
export const IMGX_VERSION = 3;
export const IMGX_GRANT_VERSION = 1;
export const IMGX_SESSION_KEY_BYTES = 32;
export const IMGX_GRANT_ALGORITHM = "IMGX-GRANT-WRAP-v1";
export const IMGX_V2_ALGORITHM = "IMGX-HMAC-SHA256-v2";
export const IMGX_V3_ALGORITHM = "IMGX-AES-256-GCM-HKDF-v3";

export interface ImgxGrant {
  version: typeof IMGX_GRANT_VERSION;
  algorithm: typeof IMGX_GRANT_ALGORITHM;
  codecVersions: readonly [typeof IMGX_LEGACY_VERSION, typeof IMGX_VERSION];
  defaultCodecVersion: typeof IMGX_VERSION;
  contentAlgorithm: typeof IMGX_V3_ALGORITHM;
  legacyAlgorithm: typeof IMGX_V2_ALGORITHM;
  imageId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  keyNonce: string;
  keyHash: string;
  contentKeyHash: string;
  signature: string;
  wrappedDecodeKey: string;
  wrappedContentKey: string;
}

interface CreateImgxPageGrantOptions {
  storageKey: string;
  sessionId: string;
  imgxSecret: string;
  hmacSecret: string;
  ttlMs: number;
  now?: number;
  randomBytes?: (byteLength: number) => Uint8Array;
}

const normalizeStorageKey = (storageKey: string): string => storageKey.trim().replace(/^\/+/, "");

const base64UrlEncode = (bytes: Uint8Array): string => Buffer.from(bytes).toString("base64url");

const base64UrlDecode = (text: string): Buffer => Buffer.from(text, "base64url");

const sha256Base64Url = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("base64url");

export const imageIdFromStorageKey = (storageKey: string): string => {
  const safeStorageKey = normalizeStorageKey(storageKey);

  if (!safeStorageKey) {
    throw new Error("storageKey is required for IMGX image id");
  }

  return createHash("sha256").update(safeStorageKey).digest("hex").slice(0, 32);
};

export const deriveImgxKey = (imageId: string, secret: string): Buffer => {
  const safeImageId = imageId.trim();
  const safeSecret = secret.toString();

  if (!safeImageId) {
    throw new Error("imageId is required for IMGX key derivation");
  }

  if (!safeSecret.trim()) {
    throw new Error("IMGX secret is required for key derivation");
  }

  return createHash("sha256").update(safeImageId).update(safeSecret).digest();
};

export const deriveImgxContentKey = (options: { imageId: string; secret: string; storageKey: string }): Buffer => {
  const legacyKey = deriveImgxKey(options.imageId, options.secret);
  const safeStorageKey = normalizeStorageKey(options.storageKey);
  const salt = createHash("sha256").update(safeStorageKey || options.imageId).digest();
  const info = Buffer.from(["IMGX-v3", options.imageId].join("."), "utf8");

  return Buffer.from(hkdfSync("sha256", legacyKey, salt, info, IMGX_SESSION_KEY_BYTES));
};

type ImgxGrantSignaturePayload = Omit<ImgxGrant, "signature" | "wrappedDecodeKey" | "wrappedContentKey">;

const canonicalGrantPayload = (grant: ImgxGrantSignaturePayload, sessionId: string, storageKey: string): string =>
  [
    grant.version,
    grant.algorithm,
    grant.codecVersions.join(","),
    grant.contentAlgorithm,
    grant.legacyAlgorithm,
    grant.imageId,
    grant.issuedAt,
    grant.expiresAt,
    grant.nonce,
    grant.keyNonce,
    grant.keyHash,
    grant.contentKeyHash,
    sessionId,
    normalizeStorageKey(storageKey),
  ].join(".");

const signGrant = (options: {
  grant: ImgxGrantSignaturePayload;
  sessionId: string;
  storageKey: string;
  hmacSecret: string;
}): string => createHmac("sha256", options.hmacSecret).update(canonicalGrantPayload(options.grant, options.sessionId, options.storageKey)).digest("base64url");

const nextMaskXorShift32 = (value: number): number => {
  let x = value >>> 0;
  x ^= (x << 13) >>> 0;
  x ^= x >>> 17;
  x ^= (x << 5) >>> 0;
  return x >>> 0;
};

const fnv1a32 = (bytes: Uint8Array): number => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < bytes.byteLength; index += 1) {
    hash ^= bytes[index] ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return hash || 0x9e3779b9;
};

const createGrantKeyMask = (material: string, byteLength = IMGX_SESSION_KEY_BYTES): Uint8Array => {
  const safeLength = Math.max(0, Math.floor(Number(byteLength) || 0));
  const mask = new Uint8Array(safeLength);
  const materialBytes = Buffer.from(material, "utf8");
  let seed = fnv1a32(materialBytes);

  for (let index = 0; index < safeLength; index += 1) {
    if (index % 4 === 0) {
      seed = nextMaskXorShift32((seed + index + 0x9e3779b9) >>> 0);
    }

    mask[index] = (seed >>> ((index % 4) * 8)) & 0xff;
  }

  return mask;
};

const createGrantKeyWrapMaterial = (grant: Pick<ImgxGrant, "version" | "algorithm" | "imageId" | "issuedAt" | "expiresAt" | "nonce" | "keyNonce" | "signature">, storageKey: string): string =>
  [
    "IMGX-GRANT-WRAP-v1",
    grant.version,
    grant.algorithm,
    grant.imageId,
    grant.issuedAt,
    grant.expiresAt,
    grant.nonce,
    grant.keyNonce,
    grant.signature,
    normalizeStorageKey(storageKey),
  ]
    .map((part) => String(part))
    .join(".");

const wrapKeyForGrant = (options: { key: Uint8Array; grant: ImgxGrant; storageKey: string; label: string }): Buffer => {
  if (options.key.byteLength !== IMGX_SESSION_KEY_BYTES) {
    throw new Error(`${options.label} wrap requires a 32-byte key`);
  }

  const wrapped = Buffer.from(options.key);
  const mask = createGrantKeyMask(createGrantKeyWrapMaterial(options.grant, options.storageKey), wrapped.byteLength);

  for (let index = 0; index < wrapped.byteLength; index += 1) {
    wrapped[index] = (wrapped[index] ?? 0) ^ (mask[index] ?? 0);
  }

  return wrapped;
};

const wrapDecodeKeyForGrant = (options: { decodeKey: Uint8Array; grant: ImgxGrant; storageKey: string }): Buffer =>
  wrapKeyForGrant({
    key: options.decodeKey,
    grant: options.grant,
    storageKey: options.storageKey,
    label: "IMGX decode key",
  });

const unwrapWrappedKeyFromGrant = (options: {
  grant: ImgxGrant;
  storageKey: string;
  fieldName: "wrappedDecodeKey" | "wrappedContentKey";
  hashFieldName: "keyHash" | "contentKeyHash";
  label: string;
}): Buffer => {
  const wrapped = base64UrlDecode(options.grant[options.fieldName]);

  if (wrapped.byteLength !== IMGX_SESSION_KEY_BYTES) {
    throw new Error(`${options.label} invalid`);
  }

  const mask = createGrantKeyMask(createGrantKeyWrapMaterial(options.grant, options.storageKey), wrapped.byteLength);
  const key = Buffer.from(wrapped);

  for (let index = 0; index < key.byteLength; index += 1) {
    key[index] = (key[index] ?? 0) ^ (mask[index] ?? 0);
  }

  if (sha256Base64Url(key) !== options.grant[options.hashFieldName]) {
    throw new Error(`${options.label} hash mismatch`);
  }

  return key;
};

export const unwrapDecodeKeyFromGrant = (options: { grant: ImgxGrant; storageKey: string }): Buffer => {
  if (options.grant.wrappedDecodeKey) {
    return unwrapWrappedKeyFromGrant({
      grant: options.grant,
      storageKey: options.storageKey,
      fieldName: "wrappedDecodeKey",
      hashFieldName: "keyHash",
      label: "IMGX wrapped decode key",
    });
  }

  throw new Error("IMGX grant does not include a decode key");
};

export const unwrapContentKeyFromGrant = (options: { grant: ImgxGrant; storageKey: string }): Buffer => {
  if (options.grant.wrappedContentKey) {
    return unwrapWrappedKeyFromGrant({
      grant: options.grant,
      storageKey: options.storageKey,
      fieldName: "wrappedContentKey",
      hashFieldName: "contentKeyHash",
      label: "IMGX wrapped content key",
    });
  }

  throw new Error("IMGX grant does not include a content key");
};

export const createImgxPageGrant = (options: CreateImgxPageGrantOptions): ImgxGrant => {
  const storageKey = normalizeStorageKey(options.storageKey);
  const issuedAt = Number.isFinite(Number(options.now)) ? Math.floor(Number(options.now)) : Date.now();
  const ttlMs = Math.max(1000, Math.floor(Number(options.ttlMs) || 60_000));
  const randomBytes = options.randomBytes ?? cryptoRandomBytes;
  const imageId = imageIdFromStorageKey(storageKey);
  const decodeKey = deriveImgxKey(imageId, options.imgxSecret);
  const contentKey = deriveImgxContentKey({
    imageId,
    secret: options.imgxSecret,
    storageKey,
  });
  const unsigned = {
    version: IMGX_GRANT_VERSION,
    algorithm: IMGX_GRANT_ALGORITHM,
    codecVersions: [IMGX_LEGACY_VERSION, IMGX_VERSION],
    defaultCodecVersion: IMGX_VERSION,
    contentAlgorithm: IMGX_V3_ALGORITHM,
    legacyAlgorithm: IMGX_V2_ALGORITHM,
    imageId,
    issuedAt,
    expiresAt: issuedAt + ttlMs,
    nonce: base64UrlEncode(randomBytes(16)),
    keyNonce: base64UrlEncode(randomBytes(16)),
    keyHash: sha256Base64Url(decodeKey),
    contentKeyHash: sha256Base64Url(contentKey),
  } as const;
  const signed = {
    ...unsigned,
    signature: signGrant({
      grant: unsigned,
      sessionId: options.sessionId,
      storageKey,
      hmacSecret: options.hmacSecret,
    }),
  };
  const grant: ImgxGrant = {
    ...signed,
    wrappedDecodeKey: "",
    wrappedContentKey: "",
  };

  grant.wrappedDecodeKey = base64UrlEncode(wrapDecodeKeyForGrant({ decodeKey, grant, storageKey }));
  grant.wrappedContentKey = base64UrlEncode(wrapKeyForGrant({
    key: contentKey,
    grant,
    storageKey,
    label: "IMGX content key",
  }));

  return grant;
};

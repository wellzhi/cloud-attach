const encoder = new TextEncoder();

type WebCryptoBytes = Uint8Array<ArrayBuffer>;

function webCryptoBytes(value: ArrayBuffer | Uint8Array): WebCryptoBytes {
  // Copy views so Web Crypto always receives an ArrayBuffer-backed view. This
  // also avoids passing a SharedArrayBuffer-backed view on newer TypeScript DOM
  // definitions, which correctly reject it as a BufferSource.
  const source = value instanceof Uint8Array ? value : new Uint8Array(value);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy;
}

export function utf8(value: string): WebCryptoBytes {
  return webCryptoBytes(encoder.encode(value));
}

export function toHex(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Array.from(view, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(value: string | ArrayBuffer | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? utf8(value) : webCryptoBytes(value);
  return toHex(await crypto.subtle.digest("SHA-256", bytes));
}

async function importHmacKey(key: string | Uint8Array): Promise<CryptoKey> {
  const raw = typeof key === "string" ? utf8(key) : webCryptoBytes(key);
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export async function hmacSha256(key: string | Uint8Array, value: string): Promise<Uint8Array> {
  const cryptoKey = await importHmacKey(key);
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, utf8(value)));
}

export function randomHex(byteLength = 8): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function ossTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

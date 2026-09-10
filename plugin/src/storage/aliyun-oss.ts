import { requestUrl, type App } from "obsidian";
import { hmacSha256, ossTimestamp, randomHex, sha256Hex, toHex } from "../crypto";
import { normalizePrefix, normalizeRegion } from "../settings";
import type { AliyunOssSettings, ProbeResult, UploadPayload, UploadResult } from "../types";
import { extensionOf, mimeTypeFor, sleep } from "../utils";
import type { AttachmentUploader } from "./storage-adapter";

interface Credentials {
  accessKeyId: string;
  accessKeySecret: string;
}

interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

function encodeOssComponent(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function encodeOssPath(value: string): string {
  return String(value || "").split("/").map(encodeOssComponent).join("/");
}

function xmlTag(text: string, tag: string): string {
  const match = text.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  return match?.[1]?.trim() || "";
}

function ossError(status: number, body: string): string {
  const code = xmlTag(body, "Code");
  const message = xmlTag(body, "Message");
  const requestId = xmlTag(body, "RequestId");
  const details = [code, message, requestId ? `RequestId=${requestId}` : ""].filter(Boolean).join(" · ");
  return details || `Aliyun OSS request failed with HTTP ${status}.`;
}

function shouldRetry(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function extensionSuffix(filename: string): string {
  const ext = extensionOf(filename).replace(/[^a-z0-9]+/gi, "").toLowerCase();
  return ext ? `.${ext}` : "";
}

function dateParts(date = new Date()): { year: string; month: string; day: string; timestamp: string } {
  const iso = date.toISOString();
  return { year: iso.slice(0, 4), month: iso.slice(5, 7), day: iso.slice(8, 10), timestamp: iso.replace(/[-:.TZ]/g, "") };
}

function safeEndpoint(value: string): URL {
  const raw = value.trim();
  if (!raw) throw new Error("OSS endpoint is empty.");
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("OSS endpoint must use HTTP or HTTPS.");
  return url;
}

export class AliyunOssUploader implements AttachmentUploader {
  constructor(private readonly app: App, private readonly settings: () => AliyunOssSettings) {}

  isConfigured(): boolean {
    try {
      this.validateConfig();
      this.credentials();
      return true;
    } catch {
      return false;
    }
  }

  private credentials(): Credentials {
    const config = this.settings();
    if (config.credentialMode === "secret") {
      const id = config.accessKeyIdSecretName ? this.app.secretStorage.getSecret(config.accessKeyIdSecretName) || "" : "";
      const secret = config.accessKeySecretSecretName ? this.app.secretStorage.getSecret(config.accessKeySecretSecretName) || "" : "";
      if (!id || !secret) throw new Error("AccessKey secrets are not linked in SecretStorage.");
      return { accessKeyId: id.trim(), accessKeySecret: secret.trim() };
    }
    if (!config.accessKeyId.trim() || !config.accessKeySecret.trim()) throw new Error("AccessKey ID or AccessKey Secret is empty.");
    return { accessKeyId: config.accessKeyId.trim(), accessKeySecret: config.accessKeySecret.trim() };
  }

  private validateConfig(): void {
    const config = this.settings();
    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(config.bucket.trim())) throw new Error("OSS Bucket name is missing or invalid.");
    if (!normalizeRegion(config.region)) throw new Error("OSS Region is not configured.");
    if (config.endpointMode === "custom" && !config.customEndpoint.trim()) throw new Error("Custom OSS endpoint is not configured.");
  }

  private endpoint(): URL {
    const config = this.settings();
    const region = normalizeRegion(config.region);
    const raw = config.endpointMode === "custom" ? config.customEndpoint : `https://oss-${region}.aliyuncs.com`;
    const endpoint = safeEndpoint(raw);
    const bucketPrefix = `${config.bucket.trim()}.`;
    if (endpoint.hostname.toLowerCase().startsWith(bucketPrefix.toLowerCase())) {
      endpoint.hostname = endpoint.hostname.slice(bucketPrefix.length);
    }
    endpoint.pathname = "/";
    endpoint.search = "";
    endpoint.hash = "";
    return endpoint;
  }

  private objectOrigin(): string {
    const endpoint = this.endpoint();
    return `${endpoint.protocol}//${this.settings().bucket.trim()}.${endpoint.host}`;
  }

  private publicUrl(key: string): string {
    const configured = this.settings().publicBaseUrl.trim().replace(/\/+$/, "");
    const base = configured || this.objectOrigin();
    return `${base}/${encodeOssPath(key)}`;
  }

  private requestUrl(key: string): string {
    return `${this.objectOrigin()}/${encodeOssPath(key)}`;
  }

  private async buildKey(payload: UploadPayload): Promise<{ key: string; sha256?: string }> {
    const config = this.settings();
    const prefix = normalizePrefix(config.prefix);
    const date = dateParts();
    const suffix = extensionSuffix(payload.filename);
    let tail: string;
    let hash: string | undefined;
    if (config.keyStrategy === "content-hash") {
      hash = await sha256Hex(payload.bytes);
      tail = `${date.year}/${date.month}/${hash.slice(0, 2)}/${hash}${suffix}`;
    } else {
      tail = `${date.year}/${date.month}/${date.day}/${date.timestamp}-${randomHex(8)}${suffix}`;
    }
    return { key: [prefix, tail].filter(Boolean).join("/"), sha256: hash };
  }

  private async sign(method: string, key: string, contentType = ""): Promise<SignedRequest> {
    this.validateConfig();
    const config = this.settings();
    const credentials = this.credentials();
    const region = normalizeRegion(config.region);
    const timestamp = ossTimestamp();
    const headers: Record<string, string> = {
      "x-oss-content-sha256": "UNSIGNED-PAYLOAD",
      "x-oss-date": timestamp
    };
    if (contentType) headers["content-type"] = contentType;

    // Mirrors Aliyun's official JS SDK V4 canonical request rules:
    // content-type, content-md5 and all x-oss-* headers are canonicalized automatically.
    const canonicalHeaderNames = Object.keys(headers)
      .map((name) => name.toLowerCase())
      .filter((name) => name === "content-type" || name === "content-md5" || name.startsWith("x-oss-"))
      .sort();
    const canonicalHeaders = canonicalHeaderNames.map((name) => `${name}:${headers[name].trim()}\n`).join("");
    const canonicalUri = encodeOssComponent(`/${config.bucket.trim()}/${key}`).replace(/%2F/gi, "/");
    const canonicalRequest = [method.toUpperCase(), canonicalUri, "", canonicalHeaders, "", "UNSIGNED-PAYLOAD"].join("\n");

    const date = timestamp.split("T")[0];
    const scope = `${date}/${region}/oss/aliyun_v4_request`;
    const stringToSign = ["OSS4-HMAC-SHA256", timestamp, scope, await sha256Hex(canonicalRequest)].join("\n");
    const dateKey = await hmacSha256(`aliyun_v4${credentials.accessKeySecret}`, date);
    const regionKey = await hmacSha256(dateKey, region);
    const serviceKey = await hmacSha256(regionKey, "oss");
    const signingKey = await hmacSha256(serviceKey, "aliyun_v4_request");
    const signature = toHex(await hmacSha256(signingKey, stringToSign));
    headers.Authorization = `OSS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope},Signature=${signature}`;
    return { url: this.requestUrl(key), headers };
  }

  private async put(key: string, bytes: ArrayBuffer, contentType: string): Promise<void> {
    const config = this.settings();
    let lastError = "Upload failed.";
    for (let attempt = 0; attempt <= config.retryCount; attempt++) {
      try {
        const signed = await this.sign("PUT", key, contentType);
        const response = await requestUrl({
          url: signed.url,
          method: "PUT",
          headers: signed.headers,
          body: bytes,
          throw: false
        });
        if (response.status >= 200 && response.status < 300) return;
        lastError = ossError(response.status, response.text || "");
        if (!shouldRetry(response.status) || attempt >= config.retryCount) break;
      } catch (error) {
        lastError = errorMessage(error);
        if (attempt >= config.retryCount) break;
      }
      await sleep(Math.min(3000, 300 * 2 ** attempt));
    }
    throw new Error(lastError);
  }

  private async exists(key: string): Promise<boolean> {
    const signed = await this.sign("HEAD", key);
    const response = await requestUrl({ url: signed.url, method: "HEAD", headers: signed.headers, throw: false });
    if (response.status >= 200 && response.status < 300) return true;
    if (response.status === 404) return false;
    throw new Error(ossError(response.status, response.text || ""));
  }

  private async remove(key: string): Promise<void> {
    const signed = await this.sign("DELETE", key);
    const response = await requestUrl({ url: signed.url, method: "DELETE", headers: signed.headers, throw: false });
    if (response.status >= 200 && response.status < 300) return;
    throw new Error(ossError(response.status, response.text || ""));
  }

  async upload(payload: UploadPayload): Promise<UploadResult> {
    this.validateConfig();
    const config = this.settings();
    const maxBytes = Math.floor(config.maxFileSizeMiB * 1024 * 1024);
    if (payload.bytes.byteLength > maxBytes) throw new Error(`${payload.filename} exceeds the configured ${config.maxFileSizeMiB} MiB limit.`);

    const { key, sha256 } = await this.buildKey(payload);
    let deduplicated = false;
    if (config.keyStrategy === "content-hash") {
      deduplicated = await this.exists(key);
    }
    if (!deduplicated) await this.put(key, payload.bytes, payload.mimeType || mimeTypeFor(payload.filename));

    return {
      url: this.publicUrl(key),
      key,
      filename: payload.filename,
      mimeType: payload.mimeType || mimeTypeFor(payload.filename),
      size: payload.bytes.byteLength,
      sha256,
      deduplicated
    };
  }

  async probe(): Promise<ProbeResult> {
    this.validateConfig();
    this.credentials();
    const config = this.settings();
    const key = [normalizePrefix(config.prefix), ".cloud-attach-probe", "connection.txt"].filter(Boolean).join("/");
    const bytes = new TextEncoder().encode("CloudAttach OSS probe").buffer;
    await this.put(key, bytes, "text/plain; charset=utf-8");

    let publicReadOk: boolean | null = null;
    if (config.verifyPublicAccessOnTest) {
      const response = await requestUrl({ url: this.publicUrl(key), method: "GET", throw: false });
      publicReadOk = response.status >= 200 && response.status < 300;
    }

    let cleanupOk = false;
    try {
      await this.remove(key);
      cleanupOk = true;
    } catch {
      // DeleteObject is not required for normal uploads. Keep the upload test successful
      // and report cleanup capability separately to the settings UI.
      cleanupOk = false;
    }
    return { publicReadOk, cleanupOk };
  }
}

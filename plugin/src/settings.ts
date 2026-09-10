import type { CredentialMode, DeletePolicy, EndpointMode, KeyStrategy, PluginSettings } from "./types";

export const DEFAULT_SETTINGS: PluginSettings = {
  enabled: true,
  uploadOnPaste: true,
  uploadOnDrop: true,
  embedImages: true,
  useFilenameAsLabel: true,
  deletePolicy: "immediate",
  ignoredExtensions: [],
  concurrency: 2,
  oss: {
    bucket: "",
    region: "cn-guangzhou",
    endpointMode: "auto",
    customEndpoint: "",
    prefix: "public",
    publicBaseUrl: "",
    credentialMode: "secret",
    accessKeyId: "",
    accessKeySecret: "",
    accessKeyIdSecretName: "",
    accessKeySecretSecretName: "",
    keyStrategy: "fast",
    maxFileSizeMiB: 50,
    retryCount: 2,
    verifyPublicAccessOnTest: true
  }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value.trim() : fallback;
}

function finiteNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : fallback;
}

export function mergeSettings(loaded: unknown): PluginSettings {
  const root = isRecord(loaded) ? loaded : {};
  const storedOss = isRecord(root.oss) ? root.oss : {};

  // Migration path for early direct-OSS prototypes where OSS fields lived at the root.
  const legacyOss: Record<string, unknown> = {
    bucket: root.bucket,
    region: root.region,
    prefix: root.prefix,
    publicBaseUrl: root.publicBaseUrl,
    credentialMode: root.credentialMode,
    accessKeyId: root.accessKeyId,
    accessKeySecret: root.accessKeySecret,
    accessKeyIdSecretName: root.accessKeyIdSecretName,
    accessKeySecretSecretName: root.accessKeySecretSecretName,
    maxFileSizeMiB: root.maxFileSizeMB
  };
  const oss = { ...legacyOss, ...storedOss };

  const deletePolicy = oneOf<DeletePolicy>(root.deletePolicy, ["keep", "confirm", "immediate"], DEFAULT_SETTINGS.deletePolicy);
  const credentialMode = oneOf<CredentialMode>(oss.credentialMode, ["secret", "plain"], DEFAULT_SETTINGS.oss.credentialMode);
  const endpointMode = oneOf<EndpointMode>(oss.endpointMode, ["auto", "custom"], DEFAULT_SETTINGS.oss.endpointMode);
  const keyStrategy = oneOf<KeyStrategy>(oss.keyStrategy, ["fast", "content-hash"], DEFAULT_SETTINGS.oss.keyStrategy);

  return {
    enabled: typeof root.enabled === "boolean" ? root.enabled : DEFAULT_SETTINGS.enabled,
    uploadOnPaste: typeof root.uploadOnPaste === "boolean" ? root.uploadOnPaste : DEFAULT_SETTINGS.uploadOnPaste,
    uploadOnDrop: typeof root.uploadOnDrop === "boolean" ? root.uploadOnDrop : DEFAULT_SETTINGS.uploadOnDrop,
    embedImages: typeof root.embedImages === "boolean" ? root.embedImages : DEFAULT_SETTINGS.embedImages,
    useFilenameAsLabel: typeof root.useFilenameAsLabel === "boolean" ? root.useFilenameAsLabel : DEFAULT_SETTINGS.useFilenameAsLabel,
    deletePolicy,
    ignoredExtensions: Array.isArray(root.ignoredExtensions)
      ? root.ignoredExtensions.map(String).map((item) => item.toLowerCase().replace(/^\./, "")).filter(Boolean)
      : [],
    concurrency: Math.min(4, Math.max(1, Math.floor(finiteNumber(root.concurrency, DEFAULT_SETTINGS.concurrency)))),
    oss: {
      bucket: text(oss.bucket),
      region: normalizeRegion(text(oss.region, DEFAULT_SETTINGS.oss.region)),
      endpointMode,
      customEndpoint: text(oss.customEndpoint),
      prefix: normalizePrefix(text(oss.prefix, DEFAULT_SETTINGS.oss.prefix)),
      publicBaseUrl: text(oss.publicBaseUrl).replace(/\/+$/, ""),
      credentialMode,
      accessKeyId: text(oss.accessKeyId),
      accessKeySecret: text(oss.accessKeySecret),
      accessKeyIdSecretName: text(oss.accessKeyIdSecretName),
      accessKeySecretSecretName: text(oss.accessKeySecretSecretName),
      keyStrategy,
      maxFileSizeMiB: Math.min(5120, Math.max(1, finiteNumber(oss.maxFileSizeMiB, DEFAULT_SETTINGS.oss.maxFileSizeMiB))),
      retryCount: Math.min(5, Math.max(0, Math.floor(finiteNumber(oss.retryCount, DEFAULT_SETTINGS.oss.retryCount)))),
      verifyPublicAccessOnTest: typeof oss.verifyPublicAccessOnTest === "boolean"
        ? oss.verifyPublicAccessOnTest
        : DEFAULT_SETTINGS.oss.verifyPublicAccessOnTest
    }
  };
}

export function normalizeRegion(region: string): string {
  return String(region || "").trim().toLowerCase().replace(/^oss-/, "");
}

export function normalizePrefix(prefix: string): string {
  return String(prefix || "").trim().replace(/^\/+|\/+$/g, "");
}

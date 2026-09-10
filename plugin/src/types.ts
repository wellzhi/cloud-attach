import type { TFile } from "obsidian";

export type DeletePolicy = "keep" | "confirm" | "immediate";
export type UploadTrigger = "paste" | "drop" | "picker" | "migration";
export type ProgressPhase = "scanning" | "uploading" | "rewriting" | "deleting" | "done";
export type CredentialMode = "secret" | "plain";
export type EndpointMode = "auto" | "custom";
export type KeyStrategy = "fast" | "content-hash";

export interface AliyunOssSettings {
  bucket: string;
  region: string;
  endpointMode: EndpointMode;
  customEndpoint: string;
  prefix: string;
  publicBaseUrl: string;
  credentialMode: CredentialMode;
  accessKeyId: string;
  accessKeySecret: string;
  accessKeyIdSecretName: string;
  accessKeySecretSecretName: string;
  keyStrategy: KeyStrategy;
  maxFileSizeMiB: number;
  retryCount: number;
  verifyPublicAccessOnTest: boolean;
}

export interface PluginSettings {
  enabled: boolean;
  uploadOnPaste: boolean;
  uploadOnDrop: boolean;
  embedImages: boolean;
  useFilenameAsLabel: boolean;
  deletePolicy: DeletePolicy;
  ignoredExtensions: string[];
  concurrency: number;
  oss: AliyunOssSettings;
}

export interface UploadPayload {
  bytes: ArrayBuffer;
  filename: string;
  mimeType: string;
  trigger: UploadTrigger;
}

export interface UploadResult {
  url: string;
  key: string;
  filename: string;
  mimeType: string;
  size: number;
  sha256?: string;
  deduplicated?: boolean;
}

export interface ProbeResult {
  publicReadOk: boolean | null;
  cleanupOk: boolean;
}

export interface LocalRef {
  start: number;
  end: number;
  target: string;
  label: string;
}

export interface AttachmentCandidate {
  file: TFile;
  refs: LocalRef[];
}

export interface MigrationPlanItem {
  note: TFile;
  candidates: AttachmentCandidate[];
}

export interface MigrationPlan {
  items: MigrationPlanItem[];
  noteCount: number;
  uniqueFiles: TFile[];
  totalBytes: number;
  totalReferences: number;
}

export interface MigrationResult {
  notesChanged: number;
  filesUploaded: number;
  linksReplaced: number;
  filesDeleted: number;
  filesProtected: number;
  pendingDelete: TFile[];
  failures: Array<{ path: string; message: string }>;
}

export interface ProgressState {
  phase: ProgressPhase;
  current: number;
  total: number;
  label: string;
}

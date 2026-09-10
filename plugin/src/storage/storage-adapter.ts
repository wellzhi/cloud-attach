import type { ProbeResult, UploadPayload, UploadResult } from "../types";

export interface AttachmentUploader {
  upload(payload: UploadPayload): Promise<UploadResult>;
  probe(): Promise<ProbeResult>;
  isConfigured(): boolean;
}

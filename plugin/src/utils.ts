import type { Editor } from "obsidian";

const MIME_MAP: Record<string, string> = {
  pdf: "application/pdf", epub: "application/epub+zip", zip: "application/zip", rar: "application/vnd.rar", "7z": "application/x-7z-compressed",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", heic: "image/heic", bmp: "image/bmp", tiff: "image/tiff",
  mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", flac: "audio/flac", ogg: "audio/ogg", aac: "audio/aac",
  mp4: "video/mp4", mov: "video/quicktime", avi: "video/x-msvideo", mkv: "video/x-matroska", webm: "video/webm"
};

export function extensionOf(name: string): string {
  const base = String(name || "").split(/[?#]/)[0];
  const index = base.lastIndexOf(".");
  return index > -1 && index < base.length - 1 ? base.slice(index + 1).toLowerCase() : "";
}

export function mimeTypeFor(name: string, browserType = ""): string {
  return browserType || MIME_MAP[extensionOf(name)] || "application/octet-stream";
}

export function isImage(name: string, mimeType = ""): boolean {
  return mimeType.startsWith("image/") || mimeTypeFor(name).startsWith("image/");
}

export function basename(path: string): string {
  return String(path || "").split("/").pop() || path;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GiB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

export function escapeMarkdownLabel(label: string): string {
  return String(label || "attachment").replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}

export function renderRemoteLink(filename: string, url: string, mimeType: string, embedImages: boolean, useFilenameAsLabel: boolean): string {
  const label = useFilenameAsLabel ? escapeMarkdownLabel(filename) : "";
  if (embedImages && isImage(filename, mimeType)) return `![${label}](${url})`;
  return `[${label || "attachment"}](${url})`;
}

export function randomToken(prefix = "cloud-attach"): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const random = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function replaceEditorToken(editor: Editor, token: string, replacement: string): boolean {
  const value = editor.getValue();
  const index = value.indexOf(token);
  if (index < 0) return false;
  const from = editor.offsetToPos(index);
  const to = editor.offsetToPos(index + token.length);
  editor.replaceRange(replacement, from, to);
  return true;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let cursor = 0;
  const count = Math.min(items.length, Math.max(1, Math.floor(limit)));
  const runners = Array.from({ length: count }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

export function collectTransferFiles(data: DataTransfer | null | undefined): File[] {
  if (!data) return [];
  const seen = new Set<string>();
  const result: File[] = [];
  const add = (file: File | null) => {
    if (!file) return;
    const key = `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push(file);
  };
  for (const file of Array.from(data.files || [])) add(file);
  for (const item of Array.from(data.items || [])) if (item.kind === "file") add(item.getAsFile());
  return result;
}

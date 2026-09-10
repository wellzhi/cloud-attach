import { normalizePath, TFile, type App } from "obsidian";
import type { AttachmentCandidate, MigrationPlan, MigrationPlanItem, MigrationResult, PluginSettings, ProgressState, UploadResult } from "./types";
import type { AttachmentUploader } from "./storage/storage-adapter";
import { extractLocalRefs } from "./link-parser";
import { basename, extensionOf, mapLimit, mimeTypeFor, renderRemoteLink } from "./utils";

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

function normalizeRelativePath(baseFolder: string, target: string): string {
  const absolute = target.startsWith("/") ? target.slice(1) : `${baseFolder ? `${baseFolder}/` : ""}${target}`;
  const output: string[] = [];
  for (const segment of absolute.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") continue;
    if (segment === "..") output.pop();
    else output.push(segment);
  }
  return normalizePath(output.join("/"));
}

export class AttachmentService {
  constructor(
    private readonly app: App,
    private readonly settings: () => PluginSettings,
    private readonly uploader: AttachmentUploader
  ) {}

  private isIgnored(file: TFile): boolean {
    const ext = file.extension.toLowerCase();
    return this.settings().ignoredExtensions.includes(ext);
  }

  private resolveTarget(target: string, note: TFile): TFile | null {
    const fromCache = this.app.metadataCache.getFirstLinkpathDest(target, note.path);
    if (fromCache instanceof TFile) return fromCache;

    const direct = this.app.vault.getAbstractFileByPath(normalizePath(target));
    if (direct instanceof TFile) return direct;

    const folder = note.parent?.path || "";
    const relative = this.app.vault.getAbstractFileByPath(normalizeRelativePath(folder, target));
    return relative instanceof TFile ? relative : null;
  }

  async candidatesForNote(note: TFile): Promise<AttachmentCandidate[]> {
    const text = await this.app.vault.read(note);
    const refs = extractLocalRefs(text);
    const grouped = new Map<string, AttachmentCandidate>();

    for (const ref of refs) {
      const file = this.resolveTarget(ref.target, note);
      if (!(file instanceof TFile) || file.extension.toLowerCase() === "md" || this.isIgnored(file)) continue;
      const existing = grouped.get(file.path);
      if (existing) {
        existing.refs.push(ref);
      } else {
        grouped.set(file.path, {
          file,
          refs: [ref]
        });
      }
    }
    return Array.from(grouped.values()).sort((a, b) => a.file.path.localeCompare(b.file.path));
  }

  async planCurrent(note: TFile): Promise<MigrationPlan> {
    const candidates = await this.candidatesForNote(note);
    return this.buildPlan(candidates.length ? [{ note, candidates }] : []);
  }

  async planVault(onProgress?: (state: ProgressState) => void): Promise<MigrationPlan> {
    const notes = this.app.vault.getMarkdownFiles();
    const items: MigrationPlanItem[] = [];
    for (let index = 0; index < notes.length; index++) {
      const note = notes[index];
      onProgress?.({ phase: "scanning", current: index + 1, total: notes.length, label: note.path });
      const candidates = await this.candidatesForNote(note);
      if (candidates.length) items.push({ note, candidates });
    }
    return this.buildPlan(items);
  }

  private buildPlan(items: MigrationPlanItem[]): MigrationPlan {
    const unique = new Map<string, TFile>();
    let references = 0;
    for (const item of items) {
      for (const candidate of item.candidates) {
        unique.set(candidate.file.path, candidate.file);
        references += candidate.refs.length;
      }
    }
    const uniqueFiles = Array.from(unique.values()).sort((a, b) => a.path.localeCompare(b.path));
    return {
      items,
      noteCount: items.length,
      uniqueFiles,
      totalBytes: uniqueFiles.reduce((sum, file) => sum + file.stat.size, 0),
      totalReferences: references
    };
  }

  async migrate(plan: MigrationPlan, onProgress?: (state: ProgressState) => void): Promise<MigrationResult> {
    const config = this.settings();
    const uploadMap = new Map<string, UploadResult>();
    const failures: Array<{ path: string; message: string }> = [];

    await mapLimit(plan.uniqueFiles, config.concurrency, async (file, index) => {
      onProgress?.({ phase: "uploading", current: index + 1, total: plan.uniqueFiles.length, label: file.path });
      try {
        const bytes = await this.app.vault.readBinary(file);
        const result = await this.uploader.upload({
          bytes,
          filename: file.name,
          mimeType: mimeTypeFor(file.name),
          trigger: "migration"
        });
        uploadMap.set(file.path, result);
      } catch (error) {
        failures.push({ path: file.path, message: errorMessage(error) });
      }
    });

    let notesChanged = 0;
    let linksReplaced = 0;
    for (let index = 0; index < plan.items.length; index++) {
      const item = plan.items[index];
      onProgress?.({ phase: "rewriting", current: index + 1, total: plan.items.length, label: item.note.path });
      const replacementsForNote = new Map<string, UploadResult>();
      for (const candidate of item.candidates) {
        const uploaded = uploadMap.get(candidate.file.path);
        if (uploaded) replacementsForNote.set(candidate.file.path, uploaded);
      }
      if (!replacementsForNote.size) continue;

      let replacedInNote = 0;
      await this.app.vault.process(item.note, (current) => {
        const rewritten = this.rewriteCurrentText(current, item.note, replacementsForNote);
        replacedInNote = rewritten.replaced;
        return rewritten.text;
      });
      if (replacedInNote > 0) notesChanged += 1;
      linksReplaced += replacedInNote;
    }

    const uploadedFiles = plan.uniqueFiles.filter((file) => uploadMap.has(file.path));

    const remaining = await this.remainingLocalReferencePaths();
    const safeToDelete = uploadedFiles.filter((file) => !remaining.has(file.path));
    const filesProtected = uploadedFiles.length - safeToDelete.length;
    let filesDeleted = 0;
    let pendingDelete: TFile[] = [];

    if (config.deletePolicy === "immediate") {
      for (let index = 0; index < safeToDelete.length; index++) {
        const file = safeToDelete[index];
        onProgress?.({ phase: "deleting", current: index + 1, total: safeToDelete.length, label: file.path });
        try {
          const current = this.app.vault.getAbstractFileByPath(file.path);
          if (current instanceof TFile) {
            await this.app.fileManager.trashFile(current);
            filesDeleted += 1;
          }
        } catch (error) {
          failures.push({ path: file.path, message: `Delete failed: ${errorMessage(error)}` });
        }
      }
    } else if (config.deletePolicy === "confirm") {
      pendingDelete = safeToDelete;
    }

    onProgress?.({ phase: "done", current: 1, total: 1, label: "done" });
    return {
      notesChanged,
      filesUploaded: uploadMap.size,
      linksReplaced,
      filesDeleted,
      filesProtected,
      pendingDelete,
      failures
    };
  }

  async trashFiles(files: TFile[]): Promise<number> {
    const remaining = await this.remainingLocalReferencePaths();
    let count = 0;
    for (const file of files) {
      if (remaining.has(file.path)) continue;
      const current = this.app.vault.getAbstractFileByPath(file.path);
      if (current instanceof TFile) {
        await this.app.fileManager.trashFile(current);
        count += 1;
      }
    }
    return count;
  }

  private rewriteCurrentText(current: string, note: TFile, uploadMap: Map<string, UploadResult>): { text: string; replaced: number } {
    const refs = extractLocalRefs(current);
    const replacements: Array<{ start: number; end: number; text: string }> = [];
    const config = this.settings();

    for (const ref of refs) {
      const file = this.resolveTarget(ref.target, note);
      if (!(file instanceof TFile)) continue;
      const uploaded = uploadMap.get(file.path);
      if (!uploaded) continue;
      const preferredLabel = ref.label && ref.label !== basename(ref.target) ? ref.label : uploaded.filename;
      const filename = config.useFilenameAsLabel ? preferredLabel : uploaded.filename;
      replacements.push({
        start: ref.start,
        end: ref.end,
        text: renderRemoteLink(filename, uploaded.url, uploaded.mimeType, config.embedImages, config.useFilenameAsLabel)
      });
    }

    let text = current;
    for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
      text = text.slice(0, replacement.start) + replacement.text + text.slice(replacement.end);
    }
    return { text, replaced: replacements.length };
  }

  private async remainingLocalReferencePaths(): Promise<Set<string>> {
    const paths = new Set<string>();
    for (const note of this.app.vault.getMarkdownFiles()) {
      const text = await this.app.vault.read(note);
      for (const ref of extractLocalRefs(text)) {
        const file = this.resolveTarget(ref.target, note);
        if (file instanceof TFile && file.extension.toLowerCase() !== "md") paths.add(file.path);
      }
    }
    return paths;
  }

  isIncomingFileIgnored(file: File): boolean {
    const ext = extensionOf(file.name);
    return !!ext && this.settings().ignoredExtensions.includes(ext);
  }
}

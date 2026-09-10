import { MarkdownView, Notice, Plugin, TFile, type Editor, type MarkdownFileInfo } from "obsidian";
import { AttachmentService } from "./attachment-service";
import { t } from "./i18n";
import { mergeSettings } from "./settings";
import { AliyunOssUploader } from "./storage/aliyun-oss";
import type { PluginSettings, UploadPayload } from "./types";
import { collectTransferFiles, mapLimit, mimeTypeFor, randomToken, renderRemoteLink, replaceEditorToken } from "./utils";
import { FilePickerModal } from "./ui/file-picker-modal";
import { MigrationModal } from "./ui/migration-modal";
import { UplinkSettingTab } from "./ui/settings-tab";

function errorMessage(value: unknown): string {
  return value instanceof Error ? value.message : String(value);
}

export default class UplinkPlugin extends Plugin {
  settings!: PluginSettings;
  readonly uploader = new AliyunOssUploader(this.app, () => this.settings.oss);
  private attachmentService!: AttachmentService;

  async onload(): Promise<void> {
    this.settings = mergeSettings(await this.loadData());
    this.attachmentService = new AttachmentService(this.app, () => this.settings, this.uploader);

    this.addRibbonIcon("upload-cloud", t("ribbon"), () => this.openFilePicker());
    this.addCommand({ id: "upload-files", name: t("uploadFiles"), callback: () => this.openFilePicker() });
    this.addCommand({ id: "migrate-current-note", name: t("migrateCurrent"), callback: () => void this.migrateCurrentNote() });
    this.addCommand({ id: "migrate-vault", name: t("migrateVault"), callback: () => void this.migrateVault() });
    this.addCommand({ id: "test-aliyun-oss", name: t("testOss"), callback: () => void this.testOssConnection() });
    this.addSettingTab(new UplinkSettingTab(this.app, this));

    this.registerEvent(this.app.workspace.on("editor-paste", (evt: ClipboardEvent, editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
      if (evt.defaultPrevented || !this.settings.enabled || !this.settings.uploadOnPaste) return;
      const files = collectTransferFiles(evt.clipboardData);
      if (!files.length) return;
      evt.preventDefault();
      void this.handleIncomingFiles(files, editor, info.file, "paste");
    }));

    this.registerEvent(this.app.workspace.on("editor-drop", (evt: DragEvent, editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
      if (evt.defaultPrevented || !this.settings.enabled || !this.settings.uploadOnDrop) return;
      const files = collectTransferFiles(evt.dataTransfer);
      if (!files.length) return;
      evt.preventDefault();
      const maybeEditor = editor as Editor & { posAtCoords?: (coords: { left: number; top: number }) => { line: number; ch: number } | null };
      const dropPos = maybeEditor.posAtCoords?.({ left: evt.clientX, top: evt.clientY });
      if (dropPos) editor.setCursor(dropPos);
      void this.handleIncomingFiles(files, editor, info.file, "drop");
    }));
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  credentialsConfigured(): boolean {
    return this.uploader.isConfigured();
  }

  async testOssConnection(): Promise<void> {
    const result = await this.uploader.probe();
    new Notice(t("probeOk"));
    if (!result.cleanupOk) new Notice(t("probeCleanupFailed"), 10000);
    if (result.publicReadOk === true) new Notice(t("probePublicOk"));
    if (result.publicReadOk === false) new Notice(t("probePublicFailed"), 10000);
  }

  private requireActiveEditor(): { editor: Editor; file: TFile } | null {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view || !(view.file instanceof TFile)) {
      new Notice(t("openMarkdown"));
      return null;
    }
    return { editor: view.editor, file: view.file };
  }

  private openFilePicker(): void {
    if (!this.settings.enabled) {
      new Notice(t("disabled"));
      return;
    }
    const active = this.requireActiveEditor();
    if (!active) return;
    new FilePickerModal(this.app, (files) => void this.handleIncomingFiles(files, active.editor, active.file, "picker")).open();
  }

  private async handleIncomingFiles(files: File[], editor: Editor, note: TFile | null, trigger: "paste" | "drop" | "picker"): Promise<void> {
    const maxBytes = this.settings.oss.maxFileSizeMiB * 1024 * 1024;
    const accepted: File[] = [];
    for (const file of files) {
      if (this.attachmentService.isIncomingFileIgnored(file)) {
        new Notice(t("skippedBlocked", { name: file.name }));
        continue;
      }
      if (file.size > maxBytes) {
        new Notice(t("tooLarge", { name: file.name, size: this.settings.oss.maxFileSizeMiB }), 8000);
        continue;
      }
      accepted.push(file);
    }
    if (!accepted.length) {
      new Notice(t("noFiles"));
      return;
    }

    const placeholders = accepted.map((file) => ({ file, token: `<!-- ${randomToken("uplink-pending")} -->` }));
    editor.replaceSelection(placeholders.map((item) => item.token).join("\n"));

    const notice = new Notice(t("uploading", { current: 0, total: accepted.length, name: "…" }), 0);
    let success = 0;
    await mapLimit(placeholders, this.settings.concurrency, async ({ file, token }, index) => {
      notice.setMessage(t("uploading", { current: index + 1, total: accepted.length, name: file.name }));
      try {
        const payload: UploadPayload = {
          bytes: await file.arrayBuffer(),
          filename: file.name,
          mimeType: mimeTypeFor(file.name, file.type),
          trigger
        };
        const result = await this.uploader.upload(payload);
        const link = renderRemoteLink(result.filename, result.url, result.mimeType, this.settings.embedImages, this.settings.useFilenameAsLabel);
        await this.replacePlaceholder(editor, note, token, link);
        success += 1;
      } catch (error) {
        const message = errorMessage(error);
        await this.replacePlaceholder(editor, note, token, `**Upload failed: ${file.name}**`);
        new Notice(t("uploadFailed", { name: file.name, error: message }), 10000);
      }
    });
    notice.hide();
    if (success) new Notice(t("uploadDone", { count: success }));
  }

  private async replacePlaceholder(editor: Editor, note: TFile | null, token: string, replacement: string): Promise<void> {
    if (replaceEditorToken(editor, token, replacement)) return;
    if (!(note instanceof TFile)) return;
    await this.app.vault.process(note, (current) => current.includes(token) ? current.replace(token, replacement) : current);
  }

  private async migrateCurrentNote(): Promise<void> {
    if (!this.settings.enabled) {
      new Notice(t("disabled"));
      return;
    }
    const active = this.requireActiveEditor();
    if (!active) return;
    const plan = await this.attachmentService.planCurrent(active.file);
    if (!plan.uniqueFiles.length) {
      new Notice(t("noLocalAttachments"));
      return;
    }
    new MigrationModal(this.app, this.attachmentService, plan).open();
  }

  private async migrateVault(): Promise<void> {
    if (!this.settings.enabled) {
      new Notice(t("disabled"));
      return;
    }
    const notice = new Notice(t("scanningVault", { current: 0, total: this.app.vault.getMarkdownFiles().length, name: "…" }), 0);
    try {
      const plan = await this.attachmentService.planVault((state) => {
        notice.setMessage(t("scanningVault", { current: state.current, total: state.total, name: state.label }));
      });
      notice.hide();
      if (!plan.uniqueFiles.length) {
        new Notice(t("noLocalAttachments"));
        return;
      }
      new MigrationModal(this.app, this.attachmentService, plan).open();
    } catch (error) {
      notice.hide();
      new Notice(errorMessage(error), 10000);
    }
  }
}

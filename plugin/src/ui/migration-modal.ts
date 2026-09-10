import { Modal, Notice, Setting, type App } from "obsidian";
import type { MigrationPlan, MigrationResult, ProgressState } from "../types";
import type { AttachmentService } from "../attachment-service";
import { t } from "../i18n";
import { formatBytes } from "../utils";

export class MigrationModal extends Modal {
  private progress?: HTMLProgressElement;
  private progressText?: HTMLElement;
  private running = false;

  constructor(app: App, private readonly service: AttachmentService, private readonly plan: MigrationPlan) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("cloud-attach-modal", "cloud-attach-migration-modal");
    this.renderPlan();
  }

  private renderPlan(): void {
    this.contentEl.empty();
    new Setting(this.contentEl).setName(t("migrationTitle")).setHeading();
    this.contentEl.createEl("p", {
      text: t("migrationSummary", {
        notes: this.plan.noteCount,
        files: this.plan.uniqueFiles.length,
        links: this.plan.totalReferences,
        size: formatBytes(this.plan.totalBytes)
      }),
      cls: "cloud-attach-summary"
    });

    const list = this.contentEl.createDiv({ cls: "cloud-attach-preview-list" });
    for (const file of this.plan.uniqueFiles.slice(0, 12)) {
      const row = list.createDiv({ cls: "cloud-attach-preview-row" });
      row.createSpan({ text: file.name, cls: "cloud-attach-preview-name" });
      row.createSpan({ text: formatBytes(file.stat.size), cls: "cloud-attach-muted" });
    }
    if (this.plan.uniqueFiles.length > 12) {
      list.createDiv({ text: `+${this.plan.uniqueFiles.length - 12}`, cls: "cloud-attach-muted" });
    }

    const actions = this.contentEl.createDiv({ cls: "cloud-attach-actions" });
    new Setting(actions)
      .addButton((button) => button.setButtonText(t("cancel")).onClick(() => this.close()))
      .addButton((button) => button.setButtonText(t("startMigration")).setCta().onClick(() => void this.start()));
  }

  private async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.renderProgress();
    try {
      const result = await this.service.migrate(this.plan, (state) => this.updateProgress(state));
      this.renderResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(message, 10000);
      this.contentEl.createEl("pre", { text: message, cls: "cloud-attach-error" });
    } finally {
      this.running = false;
    }
  }

  private renderProgress(): void {
    this.contentEl.empty();
    new Setting(this.contentEl).setName(t("migrating")).setHeading();
    this.progress = this.contentEl.createEl("progress", { cls: "cloud-attach-progress" });
    this.progress.max = 100;
    this.progress.value = 0;
    this.progressText = this.contentEl.createDiv({ text: "…", cls: "cloud-attach-summary" });
  }

  private updateProgress(state: ProgressState): void {
    if (!this.progress || !this.progressText) return;
    const total = Math.max(1, state.total);
    this.progress.value = Math.min(100, Math.round((state.current / total) * 100));
    const phase = {
      scanning: t("phaseScanning"),
      uploading: t("phaseUploading"),
      rewriting: t("phaseRewriting"),
      deleting: t("phaseDeleting"),
      done: t("phaseDone")
    }[state.phase] || state.phase;
    this.progressText.setText(`${phase} · ${state.current}/${total} · ${state.label}`);
  }

  private renderResult(result: MigrationResult): void {
    this.contentEl.empty();
    new Setting(this.contentEl).setName(t("migrationComplete")).setHeading();
    this.contentEl.createEl("p", {
      text: t("migrationResult", {
        notes: result.notesChanged,
        files: result.filesUploaded,
        links: result.linksReplaced,
        deleted: result.filesDeleted
      }),
      cls: "cloud-attach-summary"
    });
    if (result.filesProtected) this.contentEl.createEl("p", { text: t("protected", { count: result.filesProtected }), cls: "cloud-attach-info" });
    if (result.failures.length) {
      this.contentEl.createEl("p", { text: t("failedCount", { count: result.failures.length }), cls: "cloud-attach-warning" });
      this.contentEl.createEl("pre", {
        text: result.failures.slice(0, 20).map((item) => `${item.path}: ${item.message}`).join("\n"),
        cls: "cloud-attach-error"
      });
    }

    const actions = this.contentEl.createDiv({ cls: "cloud-attach-actions" });
    if (result.pendingDelete.length) {
      this.contentEl.createEl("p", { text: t("pendingDelete", { count: result.pendingDelete.length }), cls: "cloud-attach-info" });
      new Setting(actions)
        .addButton((button) => button.setButtonText(t("keepNow")).onClick(() => this.close()))
        .addButton((button) => {
          button.setButtonText(t("deleteNow"));
          button.buttonEl.addClass("mod-warning");
          button.onClick(async () => {
            const deleted = await this.service.trashFiles(result.pendingDelete);
            new Notice(t("movedTrash", { count: deleted }));
            this.close();
          });
        });
    } else {
      new Setting(actions).addButton((button) => button.setButtonText(t("close")).onClick(() => this.close()));
    }
  }
}

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
    this.modalEl.addClass("uplink-modal", "uplink-migration-modal");
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
      cls: "uplink-summary"
    });

    const list = this.contentEl.createDiv({ cls: "uplink-preview-list" });
    for (const file of this.plan.uniqueFiles.slice(0, 12)) {
      const row = list.createDiv({ cls: "uplink-preview-row" });
      row.createSpan({ text: file.name, cls: "uplink-preview-name" });
      row.createSpan({ text: formatBytes(file.stat.size), cls: "uplink-muted" });
    }
    if (this.plan.uniqueFiles.length > 12) {
      list.createDiv({ text: `+${this.plan.uniqueFiles.length - 12}`, cls: "uplink-muted" });
    }

    const actions = this.contentEl.createDiv({ cls: "uplink-actions" });
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
      this.contentEl.createEl("pre", { text: message, cls: "uplink-error" });
    } finally {
      this.running = false;
    }
  }

  private renderProgress(): void {
    this.contentEl.empty();
    new Setting(this.contentEl).setName(t("migrating")).setHeading();
    this.progress = this.contentEl.createEl("progress", { cls: "uplink-progress" });
    this.progress.max = 100;
    this.progress.value = 0;
    this.progressText = this.contentEl.createDiv({ text: "…", cls: "uplink-summary" });
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
      cls: "uplink-summary"
    });
    if (result.filesProtected) this.contentEl.createEl("p", { text: t("protected", { count: result.filesProtected }), cls: "uplink-info" });
    if (result.failures.length) {
      this.contentEl.createEl("p", { text: t("failedCount", { count: result.failures.length }), cls: "uplink-warning" });
      this.contentEl.createEl("pre", {
        text: result.failures.slice(0, 20).map((item) => `${item.path}: ${item.message}`).join("\n"),
        cls: "uplink-error"
      });
    }

    const actions = this.contentEl.createDiv({ cls: "uplink-actions" });
    if (result.pendingDelete.length) {
      this.contentEl.createEl("p", { text: t("pendingDelete", { count: result.pendingDelete.length }), cls: "uplink-info" });
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

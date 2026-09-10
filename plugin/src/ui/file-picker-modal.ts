import { Modal, Setting, type App } from "obsidian";
import { t } from "../i18n";

export class FilePickerModal extends Modal {
  constructor(app: App, private readonly onFiles: (files: File[]) => void) {
    super(app);
  }

  onOpen(): void {
    this.modalEl.addClass("uplink-modal");
    this.contentEl.empty();
    new Setting(this.contentEl).setName(t("chooseTitle")).setHeading();
    this.contentEl.createEl("p", { text: t("chooseDesc"), cls: "uplink-muted" });

    const chooser = this.contentEl.createDiv({ cls: "uplink-file-picker" });
    chooser.createDiv({ text: "↑", cls: "uplink-file-picker-icon" });
    chooser.createDiv({ text: t("chooseButton"), cls: "uplink-file-picker-title" });

    const input = chooser.createEl("input", { type: "file", cls: "uplink-native-file-input" });
    input.multiple = true;
    input.addEventListener("change", () => {
      const files = Array.from(input.files || []) as File[];
      if (files.length) {
        this.close();
        this.onFiles(files);
      }
    });
    chooser.addEventListener("click", (event) => {
      if (event.target !== input) input.click();
    });

    const actions = this.contentEl.createDiv({ cls: "uplink-actions" });
    new Setting(actions).addButton((button) => button.setButtonText(t("close")).onClick(() => this.close()));
  }
}

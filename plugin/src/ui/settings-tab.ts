import { App, Notice, PluginSettingTab, SecretComponent, Setting } from "obsidian";
import type UplinkPlugin from "../main";
import { normalizePrefix, normalizeRegion } from "../settings";
import type { CredentialMode, DeletePolicy, EndpointMode, KeyStrategy } from "../types";
import { t } from "../i18n";

function parseExtensions(value: string): string[] {
  return Array.from(new Set(value.split(/[,\s]+/).map((part) => part.trim().toLowerCase().replace(/^\./, "")).filter(Boolean))).sort();
}

export class UplinkSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: UplinkPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("uplink-settings");

    const ready = this.plugin.credentialsConfigured();
    const hero = containerEl.createDiv({ cls: "uplink-settings-hero" });
    hero.createEl("h2", { text: t("settingsTitle") });
    hero.createEl("p", { text: t("settingsIntro"), cls: "uplink-muted" });
    const statusRow = hero.createDiv({ cls: "uplink-status-row" });
    statusRow.createSpan({ text: t("statusDirect"), cls: "uplink-status-pill is-direct" });
    statusRow.createSpan({ text: ready ? t("statusReady") : t("statusMissing"), cls: `uplink-status-pill ${ready ? "is-ready" : "is-warning"}` });

    this.section(containerEl, t("ossSection"), t("ossDesc"));
    new Setting(containerEl).setName(t("bucket")).setDesc(t("bucketDesc")).addText((text) => text
      .setPlaceholder("obsidian-space-assets")
      .setValue(this.plugin.settings.oss.bucket)
      .onChange(async (value) => { this.plugin.settings.oss.bucket = value.trim(); await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName(t("region")).setDesc(t("regionDesc")).addText((text) => text
      .setPlaceholder("cn-guangzhou")
      .setValue(this.plugin.settings.oss.region)
      .onChange(async (value) => { this.plugin.settings.oss.region = normalizeRegion(value) || "cn-guangzhou"; await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName(t("prefix")).setDesc(t("prefixDesc")).addText((text) => text
      .setPlaceholder("public")
      .setValue(this.plugin.settings.oss.prefix)
      .onChange(async (value) => { this.plugin.settings.oss.prefix = normalizePrefix(value); await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName(t("publicBase")).setDesc(t("publicBaseDesc")).addText((text) => text
      .setPlaceholder("https://bucket.oss-cn-guangzhou.aliyuncs.com")
      .setValue(this.plugin.settings.oss.publicBaseUrl)
      .onChange(async (value) => { this.plugin.settings.oss.publicBaseUrl = value.trim().replace(/\/+$/, ""); await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName(t("endpointMode")).addDropdown((dropdown) => dropdown
      .addOption("auto", t("endpointAuto")).addOption("custom", t("endpointCustom"))
      .setValue(this.plugin.settings.oss.endpointMode)
      .onChange(async (value) => { this.plugin.settings.oss.endpointMode = value as EndpointMode; await this.plugin.saveSettings(); this.display(); }));

    if (this.plugin.settings.oss.endpointMode === "custom") {
      new Setting(containerEl).setName(t("customEndpoint")).setDesc(t("customEndpointDesc")).addText((text) => text
        .setPlaceholder("https://oss-cn-guangzhou.aliyuncs.com")
        .setValue(this.plugin.settings.oss.customEndpoint)
        .onChange(async (value) => { this.plugin.settings.oss.customEndpoint = value.trim(); await this.plugin.saveSettings(); }));
    }

    this.section(containerEl, t("credentials"));
    new Setting(containerEl).setName(t("credentialMode")).addDropdown((dropdown) => dropdown
      .addOption("secret", t("secretMode")).addOption("plain", t("plainMode"))
      .setValue(this.plugin.settings.oss.credentialMode)
      .onChange(async (value) => { this.plugin.settings.oss.credentialMode = value as CredentialMode; await this.plugin.saveSettings(); this.display(); }));

    if (this.plugin.settings.oss.credentialMode === "secret") {
      containerEl.createEl("p", { text: t("secretModeDesc"), cls: "uplink-info" });
      new Setting(containerEl).setName(t("accessKeyIdSecret")).setDesc(t("secretDesc")).addComponent((el) => new SecretComponent(this.app, el)
        .setValue(this.plugin.settings.oss.accessKeyIdSecretName)
        .onChange(async (value) => { this.plugin.settings.oss.accessKeyIdSecretName = value; await this.plugin.saveSettings(); }));
      new Setting(containerEl).setName(t("accessKeySecretSecret")).setDesc(t("secretDesc")).addComponent((el) => new SecretComponent(this.app, el)
        .setValue(this.plugin.settings.oss.accessKeySecretSecretName)
        .onChange(async (value) => { this.plugin.settings.oss.accessKeySecretSecretName = value; await this.plugin.saveSettings(); }));
    } else {
      containerEl.createEl("p", { text: t("plainModeWarning"), cls: "uplink-warning" });
      new Setting(containerEl).setName(t("accessKeyId")).addText((text) => text
        .setValue(this.plugin.settings.oss.accessKeyId)
        .onChange(async (value) => { this.plugin.settings.oss.accessKeyId = value.trim(); await this.plugin.saveSettings(); }));
      new Setting(containerEl).setName(t("accessKeySecret")).addText((text) => {
        text.inputEl.type = "password";
        text.setValue(this.plugin.settings.oss.accessKeySecret).onChange(async (value) => { this.plugin.settings.oss.accessKeySecret = value.trim(); await this.plugin.saveSettings(); });
      });
    }

    new Setting(containerEl).setName(t("test")).addButton((button) => button.setButtonText(t("test")).setCta().onClick(async () => {
      button.setDisabled(true); button.setButtonText(t("testing"));
      try { await this.plugin.testOssConnection(); }
      catch (error) { new Notice(error instanceof Error ? error.message : String(error), 10000); }
      finally { button.setDisabled(false); button.setButtonText(t("test")); }
    }));

    this.section(containerEl, t("automatic"));
    new Setting(containerEl).setName(t("enabled")).addToggle((toggle) => toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => { this.plugin.settings.enabled = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(t("paste")).setDesc(t("pasteDesc")).addToggle((toggle) => toggle.setValue(this.plugin.settings.uploadOnPaste).onChange(async (value) => { this.plugin.settings.uploadOnPaste = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(t("drop")).setDesc(t("dropDesc")).addToggle((toggle) => toggle.setValue(this.plugin.settings.uploadOnDrop).onChange(async (value) => { this.plugin.settings.uploadOnDrop = value; await this.plugin.saveSettings(); }));

    this.section(containerEl, t("presentation"));
    new Setting(containerEl).setName(t("embedImages")).setDesc(t("embedImagesDesc")).addToggle((toggle) => toggle.setValue(this.plugin.settings.embedImages).onChange(async (value) => { this.plugin.settings.embedImages = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(t("filenameLabel")).addToggle((toggle) => toggle.setValue(this.plugin.settings.useFilenameAsLabel).onChange(async (value) => { this.plugin.settings.useFilenameAsLabel = value; await this.plugin.saveSettings(); }));

    this.section(containerEl, t("migration"), t("deleteSafety"));
    new Setting(containerEl).setName(t("deletePolicy")).addDropdown((dropdown) => dropdown
      .addOption("keep", t("keep")).addOption("confirm", t("confirm")).addOption("immediate", t("immediate"))
      .setValue(this.plugin.settings.deletePolicy)
      .onChange(async (value) => { this.plugin.settings.deletePolicy = value as DeletePolicy; await this.plugin.saveSettings(); }));

    this.section(containerEl, t("performance"));
    new Setting(containerEl).setName(t("keyStrategy")).setDesc(t("keyFastDesc")).addDropdown((dropdown) => dropdown
      .addOption("fast", t("keyFast")).addOption("content-hash", t("keyHash"))
      .setValue(this.plugin.settings.oss.keyStrategy)
      .onChange(async (value) => { this.plugin.settings.oss.keyStrategy = value as KeyStrategy; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(t("maxSize")).addText((text) => { text.inputEl.type = "number"; text.inputEl.min = "1"; text.inputEl.max = "5120"; text.inputEl.step = "1"; text.setValue(String(this.plugin.settings.oss.maxFileSizeMiB)).onChange(async (value) => { this.plugin.settings.oss.maxFileSizeMiB = Math.min(5120, Math.max(1, Number(value) || 50)); await this.plugin.saveSettings(); }); });
    new Setting(containerEl).setName(t("concurrency")).addSlider((slider) => slider.setLimits(1, 4, 1).setDynamicTooltip().setValue(this.plugin.settings.concurrency).onChange(async (value) => { this.plugin.settings.concurrency = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(t("retryCount")).addSlider((slider) => slider.setLimits(0, 5, 1).setDynamicTooltip().setValue(this.plugin.settings.oss.retryCount).onChange(async (value) => { this.plugin.settings.oss.retryCount = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(t("verifyPublic")).addToggle((toggle) => toggle.setValue(this.plugin.settings.oss.verifyPublicAccessOnTest).onChange(async (value) => { this.plugin.settings.oss.verifyPublicAccessOnTest = value; await this.plugin.saveSettings(); }));
    new Setting(containerEl).setName(t("ignored")).setDesc(t("ignoredDesc")).addTextArea((area) => area.setPlaceholder("exe,dmg").setValue(this.plugin.settings.ignoredExtensions.join(", ")).onChange(async (value) => { this.plugin.settings.ignoredExtensions = parseExtensions(value); await this.plugin.saveSettings(); }));

    containerEl.createDiv({ text: t("mobileNote"), cls: "uplink-mobile-note" });
  }

  private section(containerEl: HTMLElement, title: string, description?: string): void {
    const wrap = containerEl.createDiv({ cls: "uplink-section-heading" });
    wrap.createEl("h3", { text: title });
    if (description) wrap.createEl("p", { text: description, cls: "uplink-muted" });
  }
}

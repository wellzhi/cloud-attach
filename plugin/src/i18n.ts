import { getLanguage } from "obsidian";

type Dict = Record<string, string>;

const en: Dict = {
  ribbon: "Upload attachments",
  uploadFiles: "Upload files to current note",
  migrateCurrent: "Migrate current note attachments",
  migrateVault: "Migrate all vault attachments",
  testOss: "Test Aliyun OSS connection",
  openMarkdown: "Open a Markdown note first.", disabled: "CloudAttach is disabled.", noFiles: "No files selected.", noLocalAttachments: "No local attachments found.",
  uploading: "Uploading {current}/{total}: {name}", uploadDone: "Uploaded {count} file(s).", uploadFailed: "Upload failed: {name} — {error}",
  probeOk: "Aliyun OSS upload probe succeeded.", probeCleanupFailed: "Upload works, but the probe object could not be deleted. DeleteObject permission is optional for normal uploads.", probePublicOk: "Public URL is readable.", probePublicFailed: "Upload works, but the public URL is not anonymously readable. Check Bucket ACL/CDN/public access settings.",
  settingsTitle: "CloudAttach", settingsIntro: "Upload images, PDFs, and any file directly from Obsidian to Aliyun OSS — no middleware or server required.",
  ossSection: "Aliyun OSS", ossDesc: "All storage parameters are configured locally. Upload requests use OSS Signature V4 and Web Crypto.",
  bucket: "Bucket", bucketDesc: "Example: obsidian-space-assets", region: "Region", regionDesc: "Example: cn-guangzhou", prefix: "Object prefix", prefixDesc: "Example: public. Leave empty to upload at the bucket root.", publicBase: "Public base URL", publicBaseDesc: "Root public/CDN URL without the object prefix. Leave empty to use the bucket OSS URL.",
  endpointMode: "Upload endpoint", endpointAuto: "Automatically derive from Region", endpointCustom: "Custom endpoint", customEndpoint: "Custom OSS endpoint", customEndpointDesc: "Advanced. Example: https://oss-cn-guangzhou.aliyuncs.com or an enabled acceleration endpoint.",
  credentials: "Credentials", credentialMode: "Credential storage", secretMode: "SecretStorage (recommended)", plainMode: "Plugin settings (easier multi-device sync)", secretModeDesc: "Secret values stay in Obsidian SecretStorage. Link the secrets on each device when necessary.", plainModeWarning: "Plain mode stores the AccessKey pair in plugin data.json. It is convenient for vault sync, but less secure. Use a dedicated least-privilege RAM user restricted to this bucket/prefix.",
  accessKeyId: "AccessKey ID", accessKeySecret: "AccessKey Secret", accessKeyIdSecret: "AccessKey ID secret", accessKeySecretSecret: "AccessKey Secret secret", secretDesc: "Select or create a secret in Obsidian SecretStorage.",
  test: "Test OSS connection", testing: "Testing…", statusReady: "Ready", statusMissing: "OSS configuration incomplete", statusDirect: "Direct OSS · no middleware",
  automatic: "Automatic upload", enabled: "Enable plugin", paste: "Upload pasted files directly", pasteDesc: "Prevents Obsidian from creating a local attachment for pasted files.", drop: "Upload dropped files directly", dropDesc: "Files dropped into the editor are uploaded directly to OSS.",
  presentation: "Remote link presentation", embedImages: "Embed images", embedImagesDesc: "Images use ![name](URL); other files use normal Markdown links.", filenameLabel: "Use filename as link label",
  migration: "Existing attachment migration", deletePolicy: "Local file after successful migration", keep: "Keep local file", confirm: "Ask before moving to trash", immediate: "Move to trash automatically", deleteSafety: "Files are trashed only after upload succeeds, Markdown links are rewritten, and no remaining Markdown note references the local file.",
  performance: "Performance and limits", maxSize: "Maximum file size (MiB)", concurrency: "Concurrent uploads", retryCount: "Upload retries", keyStrategy: "Object key strategy", keyFast: "Fast · date + secure random ID", keyHash: "Content hash · deduplicate identical files", keyFastDesc: "Fast mode avoids hashing and extra HEAD requests. Content-hash mode can deduplicate but uses more CPU/network checks.", verifyPublic: "Verify public URL during connection test", ignored: "Ignored extensions", ignoredDesc: "Comma-separated without dots, e.g. exe,dmg. Empty means allow any file type.",
  chooseTitle: "Upload files", chooseDesc: "Choose images, PDFs, Office documents, audio, video, archives, or any other files. They upload directly to OSS and are never added to the Vault.", chooseButton: "Choose files", close: "Close",
  migrationTitle: "Migrate local attachments", migrationSummary: "{notes} note(s), {files} unique file(s), {links} link(s), {size} total.", startMigration: "Upload and replace", cancel: "Cancel", migrating: "Migration in progress", migrationComplete: "Migration complete", migrationResult: "Changed {notes} note(s), uploaded {files} file(s), replaced {links} link(s), trashed {deleted} file(s).", protected: "{count} local file(s) were kept because another Markdown note still references them.", pendingDelete: "{count} uploaded local file(s) can now be moved to trash.", deleteNow: "Move to trash", keepNow: "Keep local files", failedCount: "{count} item(s) failed. Local files for failed uploads were not deleted.",
  mobileNote: "Designed for Desktop, iPhone and iPad: no Node.js, Electron or FileSystemAdapter APIs are used. Keep Obsidian in the foreground during large migrations.", skippedBlocked: "Blocked by extension rule: {name}", tooLarge: "{name} exceeds the configured {size} MiB limit.", scanningVault: "Scanning vault {current}/{total}: {name}", movedTrash: "Moved {count} file(s) to trash.", phaseScanning: "Scanning", phaseUploading: "Uploading", phaseRewriting: "Rewriting links", phaseDeleting: "Moving to trash", phaseDone: "Done"
};

const zh: Dict = {
  ribbon: "上传附件", uploadFiles: "上传文件到当前笔记", migrateCurrent: "迁移当前笔记的本地附件", migrateVault: "迁移整个 Vault 的本地附件", testOss: "测试阿里云 OSS 连接",
  openMarkdown: "请先打开一个 Markdown 笔记。", disabled: "CloudAttach 已禁用。", noFiles: "未选择文件。", noLocalAttachments: "未发现本地附件。",
  uploading: "正在上传 {current}/{total}：{name}", uploadDone: "已上传 {count} 个文件。", uploadFailed: "上传失败：{name} — {error}",
  probeOk: "阿里云 OSS 上传探测成功。", probeCleanupFailed: "上传正常，但测试对象无法删除。普通上传并不要求 DeleteObject 权限；如需自动清理测试对象，可为 RAM 用户补充删除权限。", probePublicOk: "公网 URL 可正常读取。", probePublicFailed: "OSS 上传成功，但公网 URL 无法匿名读取。请检查 Bucket ACL、CDN 或公共访问设置。",
  settingsTitle: "CloudAttach", settingsIntro: "Obsidian 直接上传图片、PDF 与任意附件到阿里云 OSS；Desktop、iPhone、iPad 均无需部署中间件或服务器。",
  ossSection: "阿里云 OSS", ossDesc: "所有存储参数直接在插件中配置，上传使用 OSS Signature V4 + Web Crypto 完成签名。",
  bucket: "Bucket", bucketDesc: "例如：obsidian-space-assets", region: "Region", regionDesc: "例如：cn-guangzhou", prefix: "存储前缀", prefixDesc: "例如：public。留空表示存储在 Bucket 根路径。", publicBase: "公网访问根地址", publicBaseDesc: "填写 Bucket/CDN 根地址，不要包含存储前缀。留空时自动使用 Bucket OSS 地址。",
  endpointMode: "上传 Endpoint", endpointAuto: "根据 Region 自动生成", endpointCustom: "自定义 Endpoint", customEndpoint: "自定义 OSS Endpoint", customEndpointDesc: "高级配置，例如 https://oss-cn-guangzhou.aliyuncs.com；也可填写已启用的传输加速 Endpoint。",
  credentials: "访问凭据", credentialMode: "凭据保存方式", secretMode: "SecretStorage（推荐）", plainMode: "插件配置（多端同步更方便）", secretModeDesc: "真正的密钥保存在 Obsidian SecretStorage 中。不同设备首次使用时可能需要分别链接 Secret。", plainModeWarning: "明文模式会把 AccessKey 保存在插件 data.json 中，跨 Vault 同步更方便，但安全性较低。务必使用专门的最小权限 RAM 用户，并把权限限制到该 Bucket/前缀。",
  accessKeyId: "AccessKey ID", accessKeySecret: "AccessKey Secret", accessKeyIdSecret: "AccessKey ID Secret", accessKeySecretSecret: "AccessKey Secret Secret", secretDesc: "从 Obsidian SecretStorage 中选择或新建 Secret。",
  test: "测试 OSS 连接", testing: "测试中…", statusReady: "已就绪", statusMissing: "OSS 配置不完整", statusDirect: "直连 OSS · 无中间件",
  automatic: "自动上传", enabled: "启用插件", paste: "粘贴文件时直接上传", pasteDesc: "拦截 Obsidian 默认附件保存，粘贴的图片/文件不进入 Vault。", drop: "拖入文件时直接上传", dropDesc: "拖入编辑器的文件直接上传 OSS，不创建本地附件。",
  presentation: "远程链接显示", embedImages: "图片使用嵌入格式", embedImagesDesc: "图片生成 ![文件名](URL)，其他文件生成普通 Markdown 链接。", filenameLabel: "使用文件名作为链接文字",
  migration: "已有附件迁移", deletePolicy: "迁移成功后的本地文件", keep: "保留本地文件", confirm: "每次确认后移入回收站", immediate: "自动移入回收站", deleteSafety: "只有在远程上传成功、Markdown 链接已安全替换且整个 Vault 中不存在剩余本地引用时，文件才会移入回收站。",
  performance: "性能与限制", maxSize: "单文件最大大小（MiB）", concurrency: "并发上传数", retryCount: "失败重试次数", keyStrategy: "对象 Key 策略", keyFast: "极速 · 日期 + 安全随机 ID", keyHash: "内容哈希 · 相同文件自动去重", keyFastDesc: "极速模式不计算整文件哈希，也不会额外发 HEAD 请求；内容哈希模式可去重，但会增加 CPU 和网络检查。", verifyPublic: "测试连接时同时验证公网 URL", ignored: "忽略的扩展名", ignoredDesc: "逗号分隔且不带点，例如 exe,dmg。留空表示允许任意文件类型。",
  chooseTitle: "上传文件", chooseDesc: "可选择图片、PDF、Office 文档、音视频、压缩包或其他任意文件。文件直接上传 OSS，不进入 Vault。", chooseButton: "选择文件", close: "关闭",
  migrationTitle: "迁移本地附件", migrationSummary: "共 {notes} 篇笔记、{files} 个唯一文件、{links} 个链接，总大小 {size}。", startMigration: "上传并替换", cancel: "取消", migrating: "正在迁移", migrationComplete: "迁移完成", migrationResult: "修改 {notes} 篇笔记，上传 {files} 个文件，替换 {links} 个链接，移入回收站 {deleted} 个文件。", protected: "有 {count} 个本地文件仍被其他 Markdown 笔记引用，因此已安全保留。", pendingDelete: "有 {count} 个已上传本地文件现在可以安全移入回收站。", deleteNow: "移入回收站", keepNow: "保留本地文件", failedCount: "有 {count} 项失败；失败项对应的本地文件不会删除。",
  mobileNote: "面向 Desktop、iPhone、iPad 的跨端实现：不使用 Node.js、Electron 或 FileSystemAdapter。大批量迁移时请保持 Obsidian 在前台。", skippedBlocked: "扩展名规则已阻止：{name}", tooLarge: "{name} 超过已配置的 {size} MiB 大小限制。", scanningVault: "正在扫描 Vault {current}/{total}：{name}", movedTrash: "已将 {count} 个文件移入回收站。", phaseScanning: "扫描", phaseUploading: "上传", phaseRewriting: "替换链接", phaseDeleting: "移入回收站", phaseDone: "完成"
};

export function t(key: string, params: Record<string, string | number> = {}): string {
  const lang = String(getLanguage() || "en").toLowerCase();
  const dict = lang.startsWith("zh") ? zh : en;
  let value = dict[key] || en[key] || key;
  for (const [name, replacement] of Object.entries(params)) value = value.split(`{${name}}`).join(String(replacement));
  return value;
}

# CloudAttach

**CloudAttach** 是一款将 Obsidian 附件直接上传至阿里云 OSS 的跨平台插件。它支持桌面端、iPhone 和 iPad；无需自建服务器、Docker、中转服务或桌面端文件系统 API。

粘贴、拖入或选择文件后，CloudAttach 会把文件直接传到你的 OSS Bucket，并将笔记中的本地附件链接替换为远程链接。已有附件也可以按当前笔记或整个库批量迁移。

## 功能

- **直接上传**：图片、PDF、Office 文档、压缩包、音视频及其他文件类型均可上传至阿里云 OSS。
- **顺畅写作**：支持粘贴、拖放、文件选择器三种上传方式；图片可插入为嵌入式 Markdown，其他文件以链接形式插入。
- **批量迁移**：可扫描当前笔记或整个 Vault，上传已有本地附件并更新 Markdown 链接。
- **跨端可用**：桌面端、iPhone 和 iPad 使用同一套配置与上传逻辑。
- **内容去重**：可选基于 SHA-256 的对象命名策略；相同内容不会重复上传。
- **安全删除**：迁移时先上传、再更新链接、再检查全库引用；只有已不被 Markdown 笔记引用的本地文件才会按你的策略移入废纸篓。
- **安全认证**：使用 Web Crypto 实现阿里云 OSS Signature V4（`OSS4-HMAC-SHA256`），推荐通过 Obsidian SecretStorage 保存 AccessKey。



## 安装

插件发布后，可在 Obsidian 的 **设置 → 第三方插件 → 浏览** 中搜索 `CloudAttach` 并安装启用。

也可以手动安装：将发行包中的 `main.js`、`manifest.json`、`styles.css` 和 `versions.json` 复制到：

```text
<你的 Vault>/.obsidian/plugins/cloud-attach/
```

重启 Obsidian 后，在“第三方插件”中启用 **CloudAttach**。

## 快速开始

1. 在阿里云 OSS 创建 Bucket，并准备一个仅授予该 Bucket 必要权限的 RAM 用户 AccessKey；请勿使用阿里云主账号 AccessKey。
2. 打开 **设置 → CloudAttach**，填写 Bucket 名称、地域、对象前缀和公开访问基础 URL。
3. 推荐在 **SecretStorage** 模式中分别创建或关联 AccessKey ID 与 AccessKey Secret；如选择“插件设置”模式，密钥会以明文保存至插件配置文件，仅建议用于权限受限的专用 RAM 密钥。
4. 点击“测试阿里云 OSS 连接”，确认上传连接可用。
5. 在笔记中粘贴、拖入或选择文件，即可插入 OSS 远程链接。

以广州地域 Bucket `obsidian-space-assets` 为例：


| 配置项        | 示例值                                                           |
| ---------- | ------------------------------------------------------------- |
| Bucket     | `obsidian-attachments-bucket`                                 |
| 地域         | `cn-guangzhou`                                                |
| 对象前缀       | `public`                                                      |
| 公开访问基础 URL | `https://obsidian-space-assets.oss-cn-guangzhou.aliyuncs.com` |
| 上传端点       | 自动                                                            |


> 若 Bucket 使用私有读、CDN 或自定义域名，请将“公开访问基础 URL”设为实际可访问的文件 URL 前缀。插件负责上传与生成链接，不提供文件访问鉴权或图床代理。



## 迁移已有附件

命令面板提供以下命令：

- `CloudAttach: 迁移当前笔记中的本地附件`
- `CloudAttach: 迁移整个库中的本地附件`

迁移会将每个本地文件最多上传一次，再原子化更新笔记中的引用。删除策略可设为“保留本地文件”“确认后删除”或“立即移入废纸篓”。即使选择立即删除，CloudAttach 也会先重新检查整个 Vault 的 Markdown 引用；上传失败的文件绝不会被删除。

建议第一次迁移时选择“保留本地文件”或“确认后删除”，核验 OSS 文件及笔记链接后再清理本地附件。

## 对象命名策略

- **快速（默认）**：`public/YYYY/MM/DD/<时间戳>-<随机值>.<扩展名>`。无需计算文件哈希或额外请求，适合日常上传。
- **内容哈希**：`public/YYYY/MM/<哈希前两位>/<SHA-256>.<扩展名>`。相同内容会复用同一个对象，但每次上传需要计算 SHA-256 并发送一次存在性检查请求。



## 配置与限制

- 默认最大单文件大小为 `50 MiB`，可在设置中调整，范围为 `1–5120 MiB`。
- 可设置并发数（1–4）、重试次数（0–5）及不上传的扩展名。
- 自动上传可分别控制粘贴和拖放行为。
- 插件可生成图片嵌入链接，也可选择是否以原始文件名作为链接文本。



## 构建开发版

在仓库根目录执行：

```bash
./build.sh /path/to/your-vault
```

该脚本会构建插件并安装至指定 Vault，同时保留既有 CloudAttach 配置。它还会迁移旧版 `universal-attachment-uploader` 的配置和启用状态。

## 致谢与许可证

本项目中安全迁移本地附件的思路及部分 MIT 许可代码模式，参考了 Patrick（perinchiang）的 Attachment Imagebed Manager。详细归属见 [NOTICE](NOTICE)，许可证见 [LICENSE](LICENSE)。
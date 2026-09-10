# Configuration

For the example bucket discussed during development:

| UI field | Value |
|---|---|
| Bucket | `obsidian-space-assets` |
| Region | `cn-guangzhou` |
| Object prefix | `public` |
| Public base URL | `https://obsidian-space-assets.oss-cn-guangzhou.aliyuncs.com` |
| Upload endpoint | `Automatically derive from Region` |
| Max file size | `50` MiB |
| Object key strategy | `Fast` for lowest latency, or `Content hash` for deduplication |

## Credential storage

### Recommended: SecretStorage
Choose **SecretStorage** and create/link two secrets:
- AccessKey ID
- AccessKey Secret

### Convenience: plugin settings
Choose **Plugin settings** and enter the AccessKey pair directly. This is useful when `.obsidian/plugins/.../data.json` is synced across devices, but the credentials are plaintext. Use only a dedicated least-privilege RAM user.

## Public URL
The plugin inserts permanent remote URLs into Markdown. Therefore the returned `Public base URL` must be readable by the devices that render the note (for example via public-read bucket/object policy or a CDN/custom domain).

## Test connection
The test:
1. V4-signs and uploads a small probe object.
2. Optionally verifies the public URL.
3. Attempts to delete the probe object.

Delete permission is optional for ordinary uploads; if it is unavailable, the plugin reports a warning instead of treating the upload test as failed.

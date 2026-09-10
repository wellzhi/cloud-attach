# Architecture

```text
Obsidian Desktop / iPhone / iPad
          │
          ├─ paste / drop / file picker (File + ArrayBuffer)
          │
          └─ existing Vault attachment (Vault.readBinary)
          │
          ▼
AliyunOssUploader
  ├─ Web Crypto HMAC-SHA256
  ├─ OSS Signature V4
  ├─ retry/backoff
  ├─ fast or content-hash object keys
  └─ requestUrl PUT/HEAD/DELETE
          │
          ▼
Aliyun OSS
          │
          ▼
Public/CDN URL → Markdown
```

The storage interface is intentionally small (`AttachmentUploader`). A future Tencent COS/R2 adapter can be introduced without changing paste/drop/migration services.

# Security

- Prefer Obsidian SecretStorage.
- If you choose plaintext settings for easier multi-device sync, use a dedicated Alibaba Cloud RAM user with the minimum permissions required for the configured bucket/prefix.
- Do not use an Alibaba Cloud root-account AccessKey.
- Public URLs require your OSS bucket/object/CDN policy to permit read access. Upload write credentials remain separate from public-read access.
- The connection test uploads a small probe object, optionally checks its public URL, then deletes the probe object.

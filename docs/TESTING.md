# Testing checklist

Use a test Vault before your main Vault.

1. Desktop: paste PNG → confirm no local attachment was created and remote image renders.
2. Desktop: drop PDF → confirm normal Markdown link.
3. iPhone/iPad: file picker upload → confirm URL is inserted while Obsidian remains in foreground.
4. Existing local attachment: migrate with Keep policy.
5. Repeat with Confirm policy.
6. Shared attachment referenced by two notes: migrate one note and verify the local source is protected.
7. Whole-vault migration: verify upload failures never delete local sources.
8. Test both key strategies.
9. Test connection and verify probe cleanup.

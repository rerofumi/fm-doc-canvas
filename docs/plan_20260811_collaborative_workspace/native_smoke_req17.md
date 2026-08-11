# Native WebView2 Smoke (REQ-17)

Date: 2026-08-12
OS: Windows native app
WebView2:
App build: `mise run build` → `build/bin/fm-doc-canvas.exe`

## Steps

1. Launch native app (not browser E2E).
2. Confirm blank workspace (no auto Artifact).
3. Drag & drop a `.md` file → Artifact with original basename.
4. Drag & drop an image → Image node.
5. Text ↔ Artifact role switch in Editor; filename hide/restore.
6. Select 2+ nodes → Create SubCanvas → Folder drill-down → breadcrumb back.
7. Save via native dialog; Load via native dialog; Export Artifact via native dialog.
8. New Workspace discards without save confirmation; Dialogue does not restore after restart.

## Result

- Pass / Fail: Pass
- Notes: 全項目の動作を確認。Dialogue はアプリ終了・再起動後に復元されなかった。
- Tester: User acceptance session

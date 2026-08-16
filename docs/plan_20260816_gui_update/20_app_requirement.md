# App Requirements — fm-doc-canvas GUI Update (2026-08-16)

## Purpose

キャンバスの表示面積を広げ、AI 操作を一か所へ集約し、SubCanvas に入れた情報を Undo に依存せず親階層へ戻せる GUI を提供する。

## Target Environment

- Wails v2 desktop application
- Windows / macOS / Linux
- React 18 / TypeScript / React Flow / Zustand
- 最小対象 1280x720、主対象 1920x1080

## User Experience

### Canvas-First

- 下部常設入力をなくし、ヘッダーとパンくずの下をキャンバスとして使用する。
- AI ドロワーを閉じれば、直ちにキャンバス全幅へ戻る。

### Unified Assistant

- Chat と Direct は同じドロワー、同じ入力欄、同じ Context 件数表示を使用する。
- 入力途中で Chat / Direct を切り替えても draft は失われない。
- Chat は会話として履歴へ残り、停止できる。
- Direct は Text / Image を即時生成してキャンバスへ反映する。既存 API では停止できないため、処理中表示、多重送信防止、遅延結果の stale 破棄を行う。
- `次の一手` と `Web検索` はどちらのタブでも利用できるが、結果はタブに合った表示面へ出す。
- Image Provider は共通表示とし、次回の Chat image tool / Direct image request の双方へ適用する。

### Recoverable SubCanvas

- SubCanvas 内で選択したノードを親 Canvas へ引き上げられる。
- SubCanvas を削除すると、全メンバーが親 Canvas へ移り、相対配置とメンバーに接続された Relation は保持される。
- FolderNode 自身に Relation がある場合は削除件数を確認し、同意後に Folder Relation のみ削除する。
- 解体全体を一度の Undo で元へ戻せる。

### Simple Context Feedback

- AI へ送られる Text / Image の件数だけを表示する。
- 個別リストや除外チェックボックスは提供しない。
- 一度除外したノードが再選択しても戻らない状態を残さない。

## MVP Features

| No | Area | MVP behavior |
| --- | --- | --- |
| 1 | Header | New Workspace / Save / Load をヘッダーから撤去し、主要操作を整理 |
| 2 | Breadcrumb | `Use this Canvas as context` を撤去 |
| 3 | Canvas | 下部 `PromptBar` を撤去し下端まで拡張 |
| 4 | Assistant state | Canvas ごとの共通 draft、Chat / Direct tab、Direct Text / Image mode |
| 5 | Assistant actions | 次の一手、Web検索、送信/生成、Chat停止をモード別に提供 |
| 6 | Image Provider | Chat / Direct 共通 Provider |
| 7 | Session title | 最初のユーザーメッセージから自動命名 |
| 8 | Context badge | Text / Image 件数のみ表示、除外 UI 廃止 |
| 9 | SubCanvas rename | FolderNode から名前変更 |
| 10 | Parent lift | 選択ノードを一階層上へ移動 |
| 11 | Safe dissolve | 全メンバー引き上げ、配置・Relation保持、Folder Relation確認削除 |
| 12 | Verification | Logic test、Build、Playwright Core E2E、手動 UX 受入 |

## Mode Behavior Summary

| Action | Chat | Direct |
| --- | --- | --- |
| Submit | 会話を送信しセッションへ保存 | Text / Image を生成しキャンバスへ適用 |
| Stop | `CancelChat` で停止 | 非対応。処理中表示と stale 破棄 |
| 次の一手 | 現在の会話履歴＋Canvas Context | Canvas Context のみ |
| Web検索 | `dialogue-agent` として会話タイムラインへ表示 | `direct-action` として Context Packet 面へ表示 |
| Session selector | 使用 | 非表示 |
| Image Provider | 次回 image tool に使用 | 次回 Image 生成に使用 |

## Future Candidates

- 全 UI 文言を一括対象とする i18n Full Plan
- 任意 Canvas 間の汎用移動
- Direct API のキャンセル契約
- SubCanvas への drag and drop

## Non-Goals

- 部分的な i18n
- EditorDrawer の変更
- LLM / image backend API の破壊的変更
- 保存 JSON schema の変更

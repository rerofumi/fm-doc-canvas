# Requirements — fm-doc-canvas GUI Update (2026-08-16, amended)

## Scope

Canvas-First レイアウト、Chat / Direct 統合ドロワー、Context 表示簡素化、SubCanvas の親階層への引き上げと安全解体を対象とする。

## Active Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| **REQ-02** | ヘッダーから `New Workspace`、`Save`、`Load` を撤去し、`Undo`、`Auto Layout`、`AI Assistant` を Icon + Text で識別可能にする。危険な初期化と File Operations は Settings に残す。 | Playwright で要素有無とクリック結果、手動で 1280px 幅の配置を確認 | E1 / E2 / E3 |
| **REQ-03** | `CanvasBreadcrumb` から `Use this Canvas as context` を撤去し、Parent、階層リンク、境界 Relation 表示に絞る。 | Playwright と実機表示 | E1 / E2 / E3 |
| **REQ-04** | 下部 `PromptBar` を撤去し、Canvas がウィンドウ下端まで使用可能になる。Direct 機能を失わない。 | Playwright で PromptBar 不在・Canvas bounding box・Direct 実行を確認 | E1 / E2 / E3 |
| **REQ-05** | AI ドロワーに Chat / Direct tab と Canvas ごとの共通 draft を提供する。idle 中の tab 切替で draft を保持し、Canvas を移動して戻った場合もその Canvas の draft を復元する。 | Store test と Playwright で tab / Canvas 切替時の draft を確認 | E1 / E2 / E3 |
| **REQ-06** | Image Provider を AI ドロワーの共通設定として保持し、Chat の `gen_image` と Direct Image の次回リクエストへ同じ選択値を渡す。 | request payload の logic test と Playwright | E1 / E2 / E3 |
| **REQ-07** | `次の一手`、`Web検索`、`送信/生成` を共通 action row に置き、Chat / Direct ごとに定義された処理と結果面を使用する。Chat 実行中のみ `停止` を表示する。 | action matrix の component/Playwright test、Chat cancel 観察 | E1 / E2 / E3 |
| **REQ-08** | デフォルト名の Chat session は、最初の user message を空白正規化した先頭24 Unicode文字で一度だけ自動命名し、既存 session persistence に保存する。 | Store test、保存後の再読込、UI 表示 | E1 / E2 / E3 |
| **REQ-09** | ContextPreview の展開リストと除外 checkbox を廃止し、実際の Text / Image payload 件数だけを非操作 badge で表示する。既存 `excludedNodeIds` を無効化・クリアし、再選択したノードが必ず context に戻る。 | resolver/store test と Playwright で再選択・badge 件数を確認 | E1 / E2 / E3 |
| **REQ-10** | FolderNode の context menu から SubCanvas 名を変更でき、空白名を拒否し、FolderNode と breadcrumb に即時反映する。 | command test と Playwright | E1 / E2 / E3 |
| **REQ-12** | SubCanvas を安全に解体する。全 member を親 Canvas へ移し、相対配置と member endpoint の Relation を保持する。FolderNode endpoint の Relation は件数を明示して確認後にのみ削除し、全変更を単一 Undo で復元できる。 | domain test、Playwright、Undo 復元比較 | E1 / E2 / E3 |
| **REQ-13** | 正規の Build、logic test、Playwright Core E2E が全て通る。 | `mise run build`、`mise run test`、`mise run e2e` | E1 |
| **REQ-14** | SubCanvas 内で選択した node を一階層上の親 Canvas へ移動できる。右クリック対象が未選択ならその1件、選択済みなら選択一式を対象とし、移動後に stale selection / focus を残さない。 | domain/store test と Playwright で単一・複数・FolderNode を確認 | E1 / E2 / E3 |
| **REQ-15** | Assistant operation は同時に1件だけ開始できる。Chat は停止可能、Direct は停止不可として進行表示する。Direct は開始時 scope を記録し、workspace / canvas / generation / scope が変わった遅延結果を適用しない。同期失敗・stale 時は draft を保持する。 | lifecycle/store test、Playwright の多重送信・navigation stale test | E1 / E2 / E3 |

## Active Non-Functional Requirements

| ID | Requirement | Verification method | Evidence class |
| --- | --- | --- | --- |
| **REQ-N01** | 1280x720 で header が折り返さず、AI drawer は 320px 以上・window 幅の80%以下で resize でき、action row が欠けない。 | Playwright viewport 1280x720 / 1920x1080 と手動 resize | E1 / E2 / E4 |
| **REQ-N02** | Tab、input、buttons、context menu、rename/delete dialog を keyboard 操作でき、focus visible、Escape、focus return、disabled、ARIA name を備える。 | Playwright keyboard test と手動 accessibility inspection | E1 / E2 / E4 |

## Requirement ID Disposition

既存 ID の意味は変更せず、ユーザー判断により次を active scope から外す。

| ID | Original requirement | Disposition |
| --- | --- | --- |
| **REQ-01** | 全 UI 文言の i18n message table 化 | **Deferred**。部分対応を避け、全 UI 文言・dialog・tooltip・error を一括移行する後続 Full Plan 候補へ分離。 |
| **REQ-11** | 任意 Canvas を選択する Move to Canvas | **Superseded in this plan**。今回の課題は Undo 以外で SubCanvas から戻すことなので、active `REQ-14` の親階層引き上げへ縮小。任意移動は将来候補。 |

## Detailed Acceptance Rules

### Assistant action matrix

| Mode | Submit | Next action | Web search | Stop | Result surface |
| --- | --- | --- | --- | --- | --- |
| Chat | `SendChat`、sessionへ user/assistant message 追加 | active session messages + current context | `dialogue-agent`。query を user message として残し tool event を timeline 表示 | `CancelChat` | MessageList / ToolCard / NextActionPanel |
| Direct Text | Text生成と node 作成 | current context のみ | `direct-action` | 非対応 | Direct receipt / Context Packet |
| Direct Image | Image生成と node 作成 | current context のみ | `direct-action` | 非対応 | Direct receipt / Context Packet |

### Input rules

- `Enter`: 改行
- `Shift+Enter`: 改行
- `Ctrl+Enter` / `Cmd+Enter`: 現在 mode を submit
- submit 成功時のみ draft を空にする。
- 同期エラー、validation error、stale discard では draft を保持する。
- operation pending 中は tab、session、provider、submit、next action、web search を無効化する。drawer close は許可し、再度開いたとき進行状態を表示する。

### SubCanvas relation rules

- Member node 同士の Relation は保持する。
- Member node と SubCanvas 外 node の Relation も endpoint が存続するため保持する。
- 削除される FolderNode 自身を endpoint とする Relation だけを確認後に削除する。
- 確認を cancel した場合は document / runtime / history を変更しない。

## Constraints

- ツール操作は `mise` を経由する。
- `.fm-canvas.json` schema は変更しない。
- Chat の既存 run correlation / freshness authority を維持する。
- Direct backend cancel は追加しない。
- SubCanvas command の拡張は atomicity、document invariant、Undo snapshot を維持する。

## Verification / Completion Conditions

- Build: `mise run build`
- Logic / unit: `mise run test`
- Core E2E: `mise run e2e`（Wails + Playwright）
- Core E2E IDs: REQ-02〜REQ-10、REQ-12、REQ-14、REQ-15、REQ-N01、REQ-N02
- Manual UX: 1280x720 と 1920x1080 で action row、drawer、dissolve 配置、keyboard focus を確認

## Out of Scope

- REQ-01 の全 UI i18n
- REQ-11 の任意 Canvas picker
- Direct backend cancellation
- EditorDrawer redesign

## Acceptance Criteria

- `90_status.md` の active REQ 全行に十分な evidence があり、別セッションまたは人間による acceptance が Pass する。
- Deferred ID は active acceptance に混ぜず、`50_review_notes.md` と後続候補に記録する。

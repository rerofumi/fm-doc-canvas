# Status — fm-doc-canvas GUI Update (2026-08-16, amended)

state: done
worklog: enabled

tier: Full
plan: plan_20260816_gui_update

## Active Acceptance Table

| ID | Requirement summary | Verification method | Evidence class | WP | Implementer state | Evidence | Acceptance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **REQ-02** | Header整理 | Playwright要素/動作 + 1280px目視 | E1/E2/E3 | WP-1 | implemented | `App.tsx` から New Workspace / Save / Load を撤去し、Undo / Auto Layout / AI Assistant を icon + text で表示。危険操作と File Operations は Settings drawer に集約。`ce2e-wp1-layout.spec.ts`（対象5件）でSettings導線、Clear Canvas確認dialog/Tab・Shift+Tab containment、Cancel/Escape/overlay後のClear trigger復帰、Confirm後のdrawer閉鎖とvisible Header Settings buttonへのfocus復帰、Clear/Undoを確認。旧Foundation/WP0 smokeのSettings経路もpass、`mise run test` / `mise run build` / full `mise run e2e`（67件）pass。 | - |
| **REQ-03** | Breadcrumb整理 | Playwright + E3 | E1/E2/E3 | WP-1 | implemented | `CanvasBreadcrumb` は Parent、階層 links、up-boundary aggregate のみに整理し、Use this Canvas as context を撤去。ancestor breadcrumb link clickで期待Canvasへ遷移し、cross-canvas fixtureのup-boundary countをrole=statusで実表示するE2Eを追加。`ce2e-wp1-layout.spec.ts`/`ce2e-acceptance-gaps.spec.ts` pass、`mise run test` / `mise run build` / full `mise run e2e`（67件）pass。 | - |
| **REQ-04** | PromptBar撤去・Canvas拡張・Direct維持 | Playwright bounding box + Direct flow | E1/E2/E3 | WP-1 | implemented | production `App` に `PromptBar` mount/参照なし。Canvas wrapper/main は `min-h-0 flex-1` とし、Direct は Unified Assistant 経由で維持。`ce2e-wp1-layout.spec.ts` でcanvas bounding/Direct submitに加え、旧PromptBar固有のGeneration mode group/Prompt textbox不在をassert。`mise run test` / `mise run build` / full `mise run e2e`（67件）pass。 | - |
| **REQ-05** | Chat/Direct tab・Canvas別共通draft | Store test + Playwright | E1/E2/E3 | WP-3 | implemented | `draftsByCanvasId` を唯一の runtime authority とし、`setPromptInput`/`appendPromptInput` と CanvasArea Web検索を active Canvas draft に統合。global `promptInput` fallback は除去。`e2eBridge` 起動時も `LoadChatSessions → hydrate/failLoad` を実行し、既存 F4 の openChat を操作可能にした。`mise run test`、全E2E 56件 pass。 | - |
| **REQ-06** | 共通Image Provider payload | Logic/payload test + Playwright | E1/E2/E3 | WP-3 | implemented | `useChatStore.imageProvider` を runtime authority とし、Chat `buildChatRequest.imageProvider` と Direct Image `generateImage`/`applyDirectImageVariant` に同じ値を渡す。Settings config は暗黙更新しない。`frontend/src/tests/sprintC.test.ts`、`frontend/e2e/ce2e-f4.spec.ts` で payload/provider を確認。`mise run build` 成功。 | - |
| **REQ-07** | Mode別action row | Component/Playwright + Chat cancel | E1/E2/E3 | WP-3 | implemented | 共通 `AssistantActionRow` に Next/Web/Submit/Chat Stop を集約し、`NextActionPanel` の初回 trigger は撤去。Next retry/dispatch も ChatDrawer の `activeOperation` wrapper 経由に統合。PromptBar Web検索も `beginOperation/finishOperation` と local loading を共有。`mise run test`、全E2E 56件 pass。 | - |
| **REQ-08** | 初回messageによるsession title・再読込保持 | Store test + reload E2E | E1/E2/E3 | WP-3 | implemented | `ChatSession.isDefaultTitle` を frontend/Go persistence の後方互換 marker として追加。新規 target-derived default は true、最初の user message と同一 store update で title を空白正規化・先頭24 Unicode文字へ更新し marker=false、二度目以降と明示 false は保護。reload/hydrate は target や復元順序に依存せず marker を authority とし、旧 marker なしは完全一致 `新しい会話` のみ true、suffix 名は false として移行。Go の strict validation、atomic save、Canvas ID save queue を維持し、保存 JSON の marker と旧データ移行を `chat_session_test.go`、true/false/legacy omitted の `toBackendChatSessions`/`fromBackendChatSessions` 専用logic testを `sprintC.test.ts`、target-derived marker=trueの raw `chat-sessions.json`、reload後target=nullのhydrate marker、初回更新/JSON=false/二度目不変を `ce2e-wp3.spec.ts` で確認。E2E順序は default保存（runtime/raw marker=true）→ user message前のreload → target=null hydrate（marker=true/title既定値）→初回message正規化（raw marker=false）→二度目message不変（raw marker=false）で固定。`mise run test`/`mise run build` 成功、WP-3 E2E 12件 pass、full E2E 59件 pass。F6 E2E 7件は全pass。 | - |
| **REQ-09** | Context badge-only・exclusion復帰 | Resolver/store test + Playwright | E1/E2/E3 | WP-4 | implemented | `ContextPreview` を payload 件数のみの `role="status"` badge に簡素化し、展開リスト・checkbox・操作ボタンを撤去。`resolveContext` は legacy `excludedNodeIds` を payload 解決へ適用せず、legacy fixture の再選択後に Chat/Direct payload へ復帰する logic/store/E2E を追加。`App.tsx` の production `PromptBar` mount を撤去し、ContextPreview は ChatDrawer の Direct selector 後・textarea 前だけに mount。Chat=`dialogue/read`、Direct Text=`generate-text`、Direct Image=`generate-image` の開始時 operation snapshot と payload provider を固定。`frontend/e2e/ce2e-wp4.spec.ts` で実表示 Text/Image 件数・ARIA・非操作 badge、legacy exclusion 再選択後の payload 復帰と件数増加を確認。`mise run test`、`mise run build`、`mise run e2e` 成功（Core E2E 61件 pass）。 | - |
| **REQ-10** | SubCanvas rename dialog | Domain + Playwright | E1/E2/E3 | WP-2 | implemented | `frontend/src/domain/workspaceCommands.ts` の renameSubCanvas（trim/空文字拒否・FolderNode同期）、`SubCanvasDialog.tsx`、`domainFoundation.test.ts`。`mise run test` / `mise run build` / `mise run e2e` 成功。 | Pass (acceptance round 1: domain + Playwright rename verified) |
| **REQ-12** | Relation/layout/Undo対応safe dissolve | Domain test + Playwright + snapshot compare | E1/E2/E3 | WP-2 | implemented | `dissolveSubCanvas` が member相対配置・共有 placement helper・member Relation保持・FolderNode endpoint Relation確認後削除・atomic snapshot Undo を実装。Undo は document/UI可視runtimeを復元しつつ runtimeGeneration/scopeEpoch を単調に進め、active async run を cancelled のまま保持する。late Chat event no-op、relationあり確認件数・cancel/confirm・member relation保持・Folder relation削除・単一Undo復元を確認。`mise run test/build/e2e` 成功 (47 passed)。 | Pass (round 4: domain/runtime freshness + full dissolve/Undo E2E verified) |
| **REQ-13** | Build・logic test・Core E2E通過 | `mise run build`; `mise run test`; `mise run e2e` | E1 | WP-5 | implemented | WP-5 verification: `orderedEventQueue.ts` を pure helper として分離し、terminal drain、duplicate/tombstone、legacy sequence 0、run/pending/gap 上限、gap expiry の fail-closed cleanup を実装。diagnostic は runId/reason を渡し、`ChatDrawer` は一致する active run だけを一度だけ error 終端化して message、local activeRuns、matching activeOperation、domain async run、backend CancelChat を解放。late terminal と別 run は無変更。`chatRunLifecycle.ts` の pure 相関 helper と `sprintC.test.ts` の queue gap/overflow、duplicate/tombstone、store lifecycle 回帰を追加。`mise exec -- npm --prefix frontend run test`（frontend logic 全件）、`mise exec -- npm --prefix frontend run build`、`mise exec -- go test -C . -count=1 ./...` 成功。Core E2E は今回未実行。 | - |
| **REQ-14** | 選択nodeの親Canvasへの引き上げ | Domain/store + Playwright | E1/E2/E3 | WP-2 | implemented | `moveNodesToParent` と `moveNodes` に Text/Artifact/Image/FolderNode対応、選択一式/右クリック単体、cycle guard、配置helper、selection/focus/context target cleanup、通知文を実装。round 2 で成功通知を `lastError` から分離し、anchor FolderNode を collision bounding box に含める回帰テストを追加。単一未選択 node・通知の親Canvas action・失敗 no-op の Playwright を追加。`mise run test/build/e2e` 成功 (45 passed)。 | Pass (round 3: single/multi/Folder subtree/Relation/action/failure E2E verified) |
| **REQ-15** | Single operation・Chat stop・Direct freshness | Lifecycle test + navigation E2E | E1/E2/E3 | WP-3 | implemented | `activeOperation` single-operation guard を submit/search/Next initial/retry/dispatch と暫定PromptBarへ適用。Direct Text/Imageは5項目scopeをdomain command内でも再検証し、stale/sync failureはnodeを作らずdraft保持。保存は backend 実key Canvas ID単位の単調 version queueで、旧generation待機saveを新generation snapshotより後に適用しない一方、Canvas切替前の最終snapshotを保持。WP-3 unit/Go/E2Eで二重操作拒否、Direct Text/Image stale、Next cancel即idle、queue raceを確認。全E2E 59件 pass。 | - |
| **REQ-N01** | 1280x720 layout / drawer resize | Playwright viewport + manual | E1/E2/E4 | WP-1/WP-3 | implemented | ChatDrawer resize を 320px〜window幅80%に clampし、proposal/action row/input を drawer内に配置。WP-1/WP-3 E2Eで1280x720/1920x1080の横overflowなし・drawer幅境界・Canvas下端到達を確認し、full `mise run e2e`（67件）pass。manual E4 は未確認。 | - |
| **REQ-N02** | Keyboard / focus / dialog accessibility | Playwright keyboard + manual inspection | E1/E2/E4 | WP-2/WP-3 | implementing (WP-2 implemented) | WP-2: `ContextMenu` は pane/edge/node を含め initial focus、Tab containment、Escape、focusable Canvas root fallbackを実装。`SubCanvasDialog` は initial focus/Tab containment/Escape/inline error/ARIA と rename/dissolve 後の focus return を実装。WP-1 Clear dialog は `ce2e-wp1-layout.spec.ts` で initial focus、Tab/Shift+Tab containment、Cancel/Escape/overlay後のClear trigger復帰、Confirm後のdrawer閉鎖とvisible Header Settings buttonへのfocus復帰を確認。WP-3 は Chat/Direct tabs、controlled textarea（Enter/Shift+Enter newline、Ctrl/Cmd+Enter submit）、disabled/ARIA、Chat Stopを実装。WP-3 E2Eでpending中のtabs/session selector/New/provider/direct mode/action disabled、drawer close/reopen、Tabでvisible targetへのfocus順を確認。manual E4 は未確認。 | Pass (WP-2 automatic scope, round 4; WP-3/manual E4 pending) |

## Final Automated Acceptance (authoritative)

2026-08-17 の最終 acceptance 調査結果を正本とする。上の Active Acceptance Table の途中ラウンド表記より本表を優先する。

| ID | Result | Remaining |
| --- | --- | --- |
| REQ-02 | Pass | - |
| REQ-03 | Pass | - |
| REQ-04 | Pass | - |
| REQ-05 | Pass | - |
| REQ-06 | Pass | - |
| REQ-07 | Pass | - |
| REQ-08 | Pass | - |
| REQ-09 | Pass | - |
| REQ-10 | Pass | - |
| REQ-12 | Pass | - |
| REQ-13 | Pass | - |
| REQ-14 | Pass | - |
| REQ-15 | Pass | - |
| REQ-N01 | Pass | Manual E4 approved 2026-08-17 |
| REQ-N02 | Pass | Manual E4 approved 2026-08-17 |

Final E1 evidence: `mise run test` Pass、`mise run build` Pass、`mise run e2e` 67/67 Pass。F6-07 Pass。`wails` / app process、34115 / 5173 listener、今回の E2E temp root の残留なし。

## Deferred ID Disposition

| ID | Disposition | Successor / condition |
| --- | --- | --- |
| **REQ-01** | Deferred: 全UI i18n | 全UI文言を一括移行する後続 Full Plan 候補 |
| **REQ-11** | Superseded in this plan: 任意Canvas picker | REQ-14で親への引き上げを実装。cross-branch需要時に再計画 |

Deferred ID は active acceptance / done 条件に含めない。

## Required Verification Evidence

| Check | Command / steps | Expected |
| --- | --- | --- |
| Build | `mise run build` | exit 0 |
| Logic / unit | `mise run test` | Go + frontend logic all pass |
| Core E2E | `mise run e2e` | Wails + Playwright all pass |
| Manual layout | 1280x720 / 1920x1080 | Header、drawer、action rowに欠け・横overflowなし |
| Manual UX | Chat/Direct、parent lift、dissolve、keyboard | `30_requirement.md` のactive REQを満たす |

## Acceptance Log

| Date | Actor/session | Result | Notes |
| --- | --- | --- | --- |
| 2026-08-16 | leader | implementation started | 実装前提と clean working copy を確認し、推奨順の WP-2 から worker を開始。 |
| 2026-08-16 | acceptance sub-agent | WP-2 fail (round 1) | REQ-10 Pass。REQ-12/14/N02 は runtime Undo、success notification、collision、focus、E2E evidence の修正が必要。 |
| 2026-08-16 | acceptance sub-agent | WP-2 fail (round 2) | UI回帰・anchor・主要focusは改善。generic Undoがcancel済みrunを再活性化するfreshness回帰と必須E2E不足が残存。 |
| 2026-08-16 | acceptance sub-agent | WP-2 fail (round 3) | REQ-14 Pass。REQ-12はlate Chat event guard、REQ-N02はpane focus fallbackの自動不適合が残存。 |
| 2026-08-16 | acceptance sub-agent | WP-2 pass (round 4) | REQ-10/12/14 と REQ-N02 WP-2自動範囲を受入。test/build/e2e成功、47 passed。manual E4は後続確認。 |
| 2026-08-17 | human decision | REQ-08 marker approved | Chat session persistenceへの後方互換な `isDefaultTitle` marker追加を許可。旧データは安全側で移行する。 |
| 2026-08-17 | acceptance sub-agent | WP-1〜WP-5 automatic pass | 正規test/build/Core E2E 67/67、全active REQの自動範囲を受入。REQ-N01/N02のmanual E4のみ残存。 |
| 2026-08-17 | human | Manual E4 Pass / final acceptance | GUI改変が期待どおりで動作も確認済み。REQ-N01/N02を受入れ、planをdoneとする。 |

## State Rule

`state: done` は Active Acceptance Table の全行が Pass した場合のみ設定する。

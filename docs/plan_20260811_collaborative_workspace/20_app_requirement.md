# App Requirements — Collaborative Workspace Foundation

## Purpose

ユーザーが課題名・保存先・分類を決めずに材料を机上へ出し、人間と AI が同じ対象と変更範囲を確認し、Discard / Export / Save のいずれでも自然に終えられる Workspace 基盤を提供する。

製品方向の正本は [05_roadmap.md](./05_roadmap.md)、canonical 用語は [08_glossary.md](./08_glossary.md) とする。[02_consultant.md](./02_consultant.md) と競合する場合は、後から確定した roadmap の D-01〜D-12 を優先する。

## Target Environment

- Windows 11、Wails v2.12.0、WebView2。
- Go 1.26.1 / Node 24.14.1 / npm 11.11.0 を確認済み。受理証拠には実 version を毎回残す。
- 既存の Canvas V1.0〜V1.2、既存 Image asset、既存 LLM / image generation 設定を維持する。
- Core E2E は一時データ領域と固定 fake provider を使い、実ユーザーの `%AppData%/fm-doc-canvas`、画像保存先、API key、外部 network に触れない。

## User Experience

### 1. Start without classification

- 起動直後は空の Workspace とし、初期 Artifact を自動作成しない。
- Text、Artifact、画像、file drop のどれからでも開始できる。
- Workspace 名、Focus 名、保存先、mode、schema を開始条件にしない。
- file import された text は元 filename を持つ Artifact role、LLM の通常 text 出力は Text role を既定とする。

### 2. Use one text object in two roles

- Text は Canvas 内で使う軽量情報、Artifact は外部 file と関係する text として表示する。
- 同じ Node を Text ↔ Artifact で即時に切り替えられる。
- 切替で本文、summary、original prompt、revision、位置、寸法、Relation、provenance、Node ID を失わない。
- Text → Artifact では仮 filename を自動提案し、切替前の modal や命名入力を要求しない。
- Artifact → Text では filename を UI から隠すが metadata として保持し、再切替時に復元する。
- Artifact role は Outcome 採用を意味しない。Text role も明示 Export できる。

### 3. Navigate one Workspace safely

- 一 Workspace は一つの root Canvas を持つ。
- 選択 Node を名前付き Folder Node の SubCanvas へまとめ、drill-down と breadcrumb で移動できる。
- 各 Node は一つの Canvas だけに所属し、移動しても identity と Relation を保持する。
- Current Canvas の Node だけを直接編集・Context・Mutation の対象とする。
- 別 Canvas への Relation は保持する。descendant方向はFolder Node badge、ancestor / sibling / 別branch方向はbreadcrumb隣接のup-boundary portalへ集約し、接続先へ移動できる。初期実装では個別 Boundary Relation Proxy を常時描画しない。
- Current Canvas / SubCanvas全体は明示集合targetとして扱えるが、direct memberだけを展開する。親CanvasでFolderを選んだだけでは子本文を読まず、対象Canvasへ移動して明示する。
- SubCanvasの解除はmemberをparentへidentity-preserving moveし、cascade deleteしない。Folder subtreeの自己/子孫moveは拒否する。

### 4. Share Context without a ritual

- Dialogue と Direct Action は、Current Canvas、明示選択、Focus、Active Context、Mutation Target の基本解決を共有する。
- 実際に外部LLM / image providerへ送るtext、image metadata / binary、送信先、tool body-access範囲をcompactなchip / disclosureで確認し、個別に除外できる。
- Dialogue Agentは画像pixelを送らず`metadata only`と示す。既存のtext-generation Direct Actionは明示画像をLLMへ、image-generation Direct Actionは明示画像を選択providerへbinaryとして送れる。
- Current Canvas 全体、別 SubCanvas、古い Chat、Candidate Context を暗黙に送らない。
- Agentのlist / search / readもpreview済みbody allowlistだけを対象にする。未選択Nodeを横断探索したい場合は`Use this Canvas as context`を明示し、direct member一覧をpreviewしてから送る。
- Dialogue は曖昧さを質問・提案で調整できる。Direct Action は入力をそのまま既定 route へ渡し、勝手に質問、Context 拡張、Dialogue 開始を行わない。

### 5. Keep human ownership of changes

- AI が変更を選んだ AL-2 操作は、対象、理由、diff、provenance を Proposal として表示する。
- ユーザーは accept、内容を編集して accept、reject、Stop を選べる。
- accept 済み mutation は undo でき、stale revision、別 Workspace / Canvas、終了済み run の変更は適用されない。
- 明示 Direct Action 自体が承認となる場合は余分な Proposal を要求しないが、変更は非破壊または undo 可能にする。
- Navigate / Load / Discard / Stop後に遅着したDialogue event、Proposal、Direct Action結果は新しいWorkspace / Canvasへ適用しない。

### 6. End according to intent

- Dialogue は active Workspace の memory-only state とし、短期会話として Agent Context に使う。
- New Workspace / Discard は現在の Workspace と Dialogue を消去し、保存確認や終了アンケートを出さない。
- Save は Node、配置、Canvas 階層、採用済み Relation、必要な provenance を保存し、raw Dialogue を含めない。
- Export は選択 Outcome だけを持ち出し、Workspace や Dialogue の保存を伴わない。
- Pause は独立状態として作らない。Short Recovery は本 MVP に含めない。

## MVP Features

| Feature | User value | Roadmap source |
| --- | --- | --- |
| Blank Workspace start | 分類・命名なしで材料から始められる | D-04, F-1D |
| Text-bearing role switch | 同じ内容を軽量メモと file-oriented text の間で往復できる | D-12 |
| Workspace / SubCanvas scope | まとまりを扱いつつ、別階層を暗黙に変更しない | D-02 |
| V1.3 migration | 既存 Canvas を失わず新 contract へ移れる | D-12, D-02 |
| Ephemeral Dialogue | 短期会話を使いながら不要な履歴を残さない | D-06, F-1A |
| Shared Context Resolver | Dialogue / Direct Action の対象解釈を予測できる | F-1B, D-05 |
| Canvas target / future context slots | SubCanvasを集合として指せ、将来のDelegated Session / Projected Contextをhidden Chatにしない | D-02, F-1B/C |
| Proposal / undo | AI 変更を理解・修正・拒否・取消できる | D-03, F-1C |
| Core E2E + native smoke | UI / Wails / Go / persistence の横断回帰を受理できる | user decision |

## Future Candidates

- F-2: non-destructive transform、typed Relation suggestion、人間操作 feedback。
- F-3: Web Context、Context Packet、Direct Tool / read-only Specialist subagent。
- F-4: multimodal context、Dialogue からの image generation / evaluation。
- F-5A: 実需が確認された場合だけ Saved Workspace Recall。
- F-5B: Generated View、Cluster View、Library View、必要時 layout。
- F-6: Go になった能力だけを組み合わせる Collaboration Orchestration。
- Short Recovery と TTL。
- 個別 Boundary Relation Proxy の詳細表示。

## Initial Non-Goals

- F-2〜F-6 の feature implementation。
- Web search、MCP client、Specialist subagent、AnyType 等の Context Provider。
- 新しい LLM / image generation provider。
- Knowledge Base、Task Manager、Research Archive、全履歴 Memory。
- Pause / Resume、保存催促、自動分類、終了時アンケート、telemetry。
- raw Chat、prompt、tool log、操作 event 全量の長期保存。
- IN / OUT integration、外部アプリへの自動 push / publish。
- 既存 `chat-sessions.json` の自動削除。
- 未選択Current Canvas本文をAgentが暗黙にlist / search / readする従来挙動。
- WebView2 固有挙動を browser E2E だけで受理すること。

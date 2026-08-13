# Plan Index

| plan | tier | summary | state | notes |
| --- | --- | --- | --- | --- |
| plan_20260406 | Full (legacy) | 初期実装（フェーズ2 含む） | done | 旧フォーマット（00_claim.md, 01_requirement.md, 02_specification.md）。docs/claim.md, docs/requirement.md, docs/specification.md に統合済み |
| plan_20260505_1 | Full | 画像生成プロバイダ切替（OpenRouter / OpenAI / Google / xAI） | done | 2026-05-05 完了。複数プロバイダ API Key 保持 + リクエスト時切替 |
| plan_20260616_1 | Full | カードでのプロンプト表示と拡縮リミッターの拡大 | done | 2026-06-16 完了。main にマージ済み。不要プロンプトノード廃止、minZoom/maxZoom 拡大 |
| plan_20260810_chat_artifact | Full | Artifact ノード + 右ドロワーチャット + エージェントループ | done | 2026-08-11 完了。Sprint A〜C 受理済み。残存 QA は明示的な EX waiver で closure |
| plan_20260811_collaborative_workspace | Full | AI協働型Workspace基盤（Text role、Workspace scope、Context、Proposal） | done | 2026-08-12 完了。D-12・D-02・F-1を受理。Core E2E / worklog enabled |
| plan_20260812_collaborative_workspace_F2 | Full | Collaborative Transform & Relate（非破壊派生・型付きRelation・共同Proposal） | done | 2026-08-13 user acceptance。REQ-18 Go、Core E2E 17/17。core slice完了後もロードマップ F-2 は後続候補の disposition 完了まで open |
| plan_20260813_web_context | Full | F-3 Web Context Acquisition（Context Packet、Direct Tool 検索、明示 Promote） | done | 2026-08-13 人間が検索導線、結果パネル、選択、Promote、Node作成を実機確認しGate Go。Core E2E 23 passed。F-3Cは`specialist_agent_bridge`将来候補へdefer。worklog enabled |
| plan_20260813_multimodal_context | Full | F-4 Multimodal Transform（既存画像生成、Image Variant、Dialogue Vision） | planned | 2026-08-13 Full plan。F-4A + Vision Context。Core E2E / worklog enabled。再生成ループと AL-3 は対象外 |

## 状態凡例

- **planned**: ドキュメント作成済み、実装未着手
- **implementing**: 実装中（`90_status.md` の implementer state に `in_progress` / `implemented` が混在）
- **accepting**: 受理検証中（`90_status.md` の acceptance 列が更新中）
- **done**: 全 REQ が受理済み
- **abandoned**: 中断・中止

## 命名規則

- `plan_YYYYMMDD_<suffix>/` の形式
- `<suffix>` は内容の 2 単語程度の snake_case（例: `chat_artifact`, `image_provider_switch`, `text_prompt_update`）
- 連番 suffix（`_1`, `_2` ...）は衝突回避時のみ使用

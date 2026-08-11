# Plan Index

| plan | tier | summary | state | notes |
| --- | --- | --- | --- | --- |
| plan_20260406 | Full (legacy) | 初期実装（フェーズ2 含む） | done | 旧フォーマット（00_claim.md, 01_requirement.md, 02_specification.md）。docs/claim.md, docs/requirement.md, docs/specification.md に統合済み |
| plan_20260505_1 | Full | 画像生成プロバイダ切替（OpenRouter / OpenAI / Google / xAI） | done | 2026-05-05 完了。複数プロバイダ API Key 保持 + リクエスト時切替 |
| plan_20260616_1 | Full | カードでのプロンプト表示と拡縮リミッターの拡大 | done | 2026-06-16 完了。main にマージ済み。不要プロンプトノード廃止、minZoom/maxZoom 拡大 |
| plan_20260810_chat_artifact | Full | Artifact ノード + 右ドロワーチャット + エージェントループ | done | 2026-08-11 完了。Sprint A〜C 受理済み。残存 QA は明示的な EX waiver で closure |
| plan_20260811_collaborative_workspace | Full | AI協働型Workspace基盤（Text role、Workspace scope、Context、Proposal） | planned | Core E2E / worklog enabled。D-12・D-02・F-1を対象とし、F-2以降はGate後の別plan |

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

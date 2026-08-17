# Review Notes — 全 UI i18n (2026-08-17)

## Review Findings

1. **別 plan が妥当**: 先行 `plan_20260816_gui_update` は i18n を deferred `REQ-01` として別 Full Plan に分離し、すでに `done` である。既存 plan の amend ではなく successor plan とする。
2. **component置換だけでは不足**: 31 TSX / 407 direct candidate に加え、store error、domain presentation mapping、default chat title、Go native dialog が user-visible copy を持つ。
3. **persistence boundary が重要**: locale を workspace/chatへ混ぜたり、切替時に existing label/title を書き換えると content integrity を壊す。
4. **E2E selector drift が大きい**: 現行73 testsはaccessible name/visible textを広く使う。locale固定とcopy assertion/operation selectorの分離が必要。
5. **library adoption は Go**: exact `i18next@26.3.6` / `react-i18next@17.0.11` は現行React/TSで初期化、interpolation、plural、selector、language switchを実測済み。
6. **baseline は green**: 2026-08-17時点でGo/frontend tests、Wails build、Core E2E 73/73がpassしている。

## Adopted Decisions

### D-01 — Bundled typed catalog

- `ja` / `en` TypeScript resourcesをapplication bundleへ含める。
- `ja` shapeに`en satisfies CatalogShape`、runtime parity/empty test、strict selector keyを組み合わせる。
- network-loaded catalogやTMSを使わない。

### D-02 — `system` / `ja` / `en` application preference

-初回はsystem locale、unsupportedはEnglish fallback。
- explicit preferenceはlocalStorageへ保存し、workspace/config/chat JSONへ入れない。
- React mount前にinitし、key/fallback flashを出さない。

### D-03 — Translation at presentation boundary

- domain/storeはsemantic code + valuesを保持し、React/i18nextをimportしない。
- enum/status/role/relation/errorはtyped presenterで翻訳する。
- raw backend/provider diagnosticはconsoleに分離し、primary UIに直接表示しない。

### D-04 — Content is not UI copy

- user input、LLM/Web output、existing labels/titles、filename/URLを翻訳・renameしない。
- generic chat titleだけは既存`isDefaultTitle` markerを用い、表示時に翻訳する。
- app-owned default labelは作成時localeで保存し、その後はcontentとして固定する。

### D-05 — Native dialog locale is explicit

- frontendのeffective localeをSave/Open/Export bindingへ明示引数で渡す。
- Go側は小さなpure copy tableを持ち、invalidはEnglish fallback。
- OS-owned button/shell copyはscope外。

### D-06 — No partial acceptance

- WP内での段階移行は許容するが、AST violation 0、catalog drift 0、ja/en core E2E、人間copy reviewまでplanをdoneにしない。
- dead `PromptBar.tsx` は翻訳して温存せず削除する。

## Fixed Planning Items

- 先行 GUI plan の Plan Index state が `planned` のままだったため、正本 `90_status.md` に合わせ `done` へ修正した。
- 「全 UI」の境界をvisible/accessible/dynamic/error/native copyと定義し、content/technical/OS-owned copyを明示分離した。
- E2E有り、worklog有りをユーザー確認済みとしてstatusへ反映した。
- dependency/API候補を未検証のまま仕様へ書かず、exact versionのlocal spike後にGoとした。

## Deferred Items

- `ja` / `en` 以外のlocale、RTL
- TMS / translator portal / remote delivery
- CI screenshot matrix
- advanced ICU rich message / relative time
- macOS/Linux native dialog実機観測（環境がない場合はREQ-07 EXとして残余riskを評価）

## Rejected Options

| Option | Reason |
| --- | --- |
| 先行 GUI plan を再度 amend | 先行planで明示的に別Full Planへdeferされ、acceptance済みscopeを再開するため |
| 部分的に日本語化 | mixed UIを残し、完了判定不能になるため |
| project-local translatorを最初から実装 | plural/interpolation/React update/type integrationを再実装する便益がないため |
| HTTP catalog / browser detector plugin | offline/first-render決定性に不要で、dependencyとfailure modeを増やすため |
| localeをconfig.jsonへ追加 | bootstrap時にconfig loadを待つ/flickerする。workspace機能設定とpresentation preferenceを結合するため |
| localeをworkspace JSONへ追加 | 同じdocumentの表示言語を固定し、content schema migrationを不要に増やすため |
| domainから`i18next.t`を呼ぶ | pure domain testとlocale-independent stateを壊すため |
| raw backend error全文を翻訳 | provider/OS diagnosticは安定contractでなく、primary guidanceとtechnical detailを分離すべきため |
| 全73 testsをja/enで二重実行 | runtime costが大きく、full workflow en + targeted dual-locale vertical sliceで必要riskを覆えるため |

## Maximum Risks

- AST checkerが見逃すcomputed string: typed descriptor/presenterとhuman sweepで補完する。
- English copy expansionによる狭幅崩れ: supported viewport E2E + E4 reviewを必須にする。
- locale switch中のactive async result: stateにlocalized proseを保存せずdescriptor/valueから再描画する。
- default title/content mutation: marker-based displayとraw JSON roundtripを検証する。
- native dialog OS差: pure Go test、Windows observation、未観測OSのEX residual riskを分離する。
- catalog key推論のcompile-time負荷: 実測悪化時だけnamespace split/selector optimizationを再検証する。

## Current Non-Goals

- function/navigation/data model redesign
- user/AI content translation
- AI system prompt locale切替
- OS shell全体のlocalization
- provider/model/API technical string translation

## Documentation Feedback

実装・acceptance後に確認済みas-built factsだけを次へ反映する。

- `docs/app_requirement.md`: supported localesとlanguage UX
- `docs/requirement.md`: UI copy consistency、content boundary、verification gate
- `docs/specification.md`: i18n architecture、locale lifecycle、message/native dialog boundary
- `docs/review_notes.md`: adopted dependencyと残存OS caveat
- `docs/cheatsheet/ui_i18n.md`: 実装時version/command/失敗・回避の確定事項
- `docs/cheatsheet/index.md` / `link.md`: version/source confirmation update

## Amend History

| Date | Change |
| --- | --- |
| 2026-08-17 | `plan_20260816_gui_update` deferred REQ-01をsuccessor Full Planとして開始。E2E/worklog enabled。 |
| 2026-08-17 | code inventory、dependency spike、baseline test/build/E2Eを反映し、REQ-01〜09 / REQ-N01〜N03とWP-1〜5を確定。 |


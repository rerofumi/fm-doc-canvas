# React / Wails UI i18n Feasibility

`fm-doc-canvas` の全 UI 文言を日本語・英語へ一括移行するための dependency、runtime、catalog、backend 境界、verification の確認結果を記録する。

## Target / Confirmation

- Confirmation date: 2026-08-17
- OS: Windows 11
- Project runtime: Wails v2.12.0、React 18.3.1、TypeScript 5.6.2、Vite 5.4.x
- Tool runtime: Node 24.14.1、npm 11.11.0（`mise.toml` pin）
- Adoption target: `i18next` 26.3.6、`react-i18next` 17.0.11
- Knowledge type: official documentation + npm package metadata + local install / runtime / build / test verification

## Local UI Surface Findings

TypeScript compiler AST を用いた disposable inventory で、production TSX の直接 UI text 候補を確認した。

- 31 TSX files / 407 candidates: JSX text、literal `aria-label` / `title` / `placeholder` / `alt`、`alert`、一部 `setError`。
- 大きい surface: `SettingsDrawer.tsx`、`ToolCard.tsx`、`NextActionPanel.tsx`、`ContextMenu.tsx`、`ProjectedContextPanel.tsx`、`App.tsx`。
- `useAppStore.ts` / `useChatStore.ts` は user-facing error と default chat title を raw string で保持する。
- `domain/orchestration.ts` は semantic mapping と日本語 presentation label を混在させている。
- `backend/file.go` は Wails native Save/Open/Export dialog の title / filter label を英語固定で作る。
- `PromptBar.tsx` は現行 `App.tsx` から import されない dead UI component である。
- Core E2E は 16 spec files で accessible name / visible text selector を広く使用する。

この数は migration size の下限であり、catalog 完全性の証明ではない。実装時は type boundary、literal checker、dual-locale E2E、human review を併用する。

## Official Behavior Used

- `react-i18next` は React hook 対応 application で `useTranslation` と `initReactI18next` を提供する。
- `i18next` は bundled resources、fallback language、supported languages、interpolation、pluralization、runtime `changeLanguage` を提供する。
- i18next の current TypeScript support は TypeScript 5 以上を対象とし、resource type augmentation、`strictKeyChecks`、selector API を使用できる。
- resource を application bundle へ直接渡せるため、HTTP backend や language detector plugin は必須ではない。
- React interpolation では React 自身が escape するため `escapeValue: false` が公式例の設定となる。

Source URL は [link.md](./link.md) に記録する。

## Minimum Adoption Verification

### Package metadata

```text
mise exec -- npm view i18next version
26.3.6

mise exec -- npm view react-i18next version
17.0.11
```

Installed package metadata で次を確認した。

- `i18next@26.3.6`: MIT、optional TypeScript peer `^5 || ^6 || ^7`
- `react-i18next@17.0.11`: MIT、peer `i18next >=26.2.0`、`react >=16.8.0`、TypeScript `^5 || ^6 || ^7`
- 現行 React 18.3.1 / TypeScript 5.6.2 は peer range 内

### Disposable runtime spike

workspace 内一時 directory に exact versions を `--no-save --ignore-scripts` で導入し、product files を変更せず次を実行した。

```text
createInstance()
  .use(initReactI18next)
  .init({ lng: "ja", fallbackLng: "en", bundled ja/en resources })

ja interpolation: こんにちは Codex
changeLanguage("en") + plural count=2: 2 items
selector API: こんにちは Selector
exit 0
```

確認後、一時 directory と dependency は削除済み。

### Project baseline

2026-08-17 に次を実行し、すべて exit 0 を確認した。

```text
mise exec -- pwsh -NoProfile -WorkingDirectory <repo> -Command 'go test -count=1 ./...'
mise exec -- npm --prefix <repo>/frontend run test
mise exec -- pwsh -NoProfile -WorkingDirectory <repo> -Command 'wails build'
mise exec -- npm --prefix <repo>/frontend run test:e2e
```

- Go tests: pass
- Frontend logic tests: pass
- Wails production build: pass
- Playwright Core E2E: 73/73 pass、temp root cleanup pass

## Decision

**Go**: `i18next@26.3.6` と `react-i18next@17.0.11` を exact version で採用できる。

Adopted constraints:

1. `ja` / `en` resources は TypeScript module として bundle し、network fetch を使わない。
2. HTTP backend、browser language detector、TMS SDK は導入しない。
3. locale preference は project-owned resolver で同期決定し、i18next へ effective locale を渡す。
4. source catalog の nested shape から target catalog parity を TypeScript で検査する。
5. `strictKeyChecks` と selector API を用い、unknown key を compile/test gate で拒否する。exact version の selector runtime 呼出しも local spike で確認済み。
6. domain code は i18next に依存させず、semantic code を presentation adapter で翻訳する。
7. raw backend/provider error は localized primary message と diagnostic を分離する。
8. Wails native dialog copy は Go 側の小さな `ja` / `en` table で扱い、effective locale を frontend binding から渡す。

## Verification Guidance

- `frontend/src/i18n/` に locale resolver、instance、resources、type augmentation、message descriptor adapter を集約する。
- custom TypeScript AST checker で production TSX の natural-language literal を検出し、brand / symbol / technical identifier の理由付き allowlist のみ許す。
- catalog parity test は missing key、extra key、empty value、key-looking fallback output を拒否する。
- E2E は locale を page load 前に固定する helper を持ち、通常 suite と dual-locale copy suite を分ける。
- translated visible text を workflow selector の唯一の anchor にしない。role + stable test id / structural state を使う。
- native dialog copy builder は Go unit test、実 native dialog は supported OS の E2 observation で確認する。

## Risks / Failure Conditions

- catalog type が大きくなり TypeScript inference が遅い場合、namespace split または selector `optimize` 設定を再評価する。
- component 内の string を移すだけで store / domain raw error を残すと、locale switch 後も一部表示が旧言語になる。
- source locale の値を test oracle に流用するだけでは翻訳品質を保証できないため、E4 review が必要。
- OS native dialog の標準 button / shell copy は application catalog で制御できない。
- `navigator.languages` または WebView profile storage の挙動が supported OS で異なる場合、system preference / persistence の実機確認が必要。

## Fallback

採用 package が build/typecheck を満たさなくなった場合は、同じ catalog shape / message descriptor / locale resolver 契約を保った project-local translator へ差し替える。部分的な raw string 復帰や E2E locale scope の縮小は fallback としない。

## Update Conditions

- React、TypeScript、i18next、react-i18next の major version 更新時
- supported locale 追加、RTL 導入、catalog namespace 分割時
- Wails / WebView の locale または profile storage 挙動変更時
- native dialog binding signature / dialog adapter 変更時
- TypeScript compile time、missing-key、locale persistence、E2E selector drift に問題が出た時

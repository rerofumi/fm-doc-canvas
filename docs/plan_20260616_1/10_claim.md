# Claim

## Purpose

画像生成・テキスト生成まわりの UX を改善し、不要なプロンプトノードの作成をやめて、カード直下の簡易プロンプト表示に切り替える。あわせてキャンバスのズーム範囲を拡大・縮小ともに 2 段階広げる。

## Background

 現在の `frontend\src\components\layout\PromptBar.tsx` では、画像生成モードで画像ノードとは別に「Prompt used for image generation」テキストノードを生成している。画像生成時のプロンプトは画像カード下に簡易表示すれば十分であることが確認できたため、ノードを増やす運用をやめる。

また、画像カードで生成プロンプトを表示すると便利であるため、テキスト生成の回答ノードにも、元の質問プロンプトをカード下へ表示する。

キャンバスについては、拡大時・縮小時に「もう少しいい具合にしたい」という場面があり、現在のズーム範囲では不足している。

## Problem

- 画像生成時に画像ノードとは別のプロンプトノードが作成され、キャンバスが不要に増える。
- 画像生成プロンプトを後から参照しづらい。
- テキスト生成の回答ノードにも、元の質問プロンプトを表示したい。
- キャンバスのズーム範囲が狭く、拡大・縮小の可動域をさらに広げたい。

## Target Users / Environment

- fm-doc-canvas のローカルデスクトップユーザー
- React + Zustand + Tailwind のフロントエンド
- React Flow (`@xyflow/react` 12 系) を使用したキャンバス
- Wails + Go バックエンドは直接変更しない前提

## Initial Scope

- 画像生成時のプロンプトノード作成をやめる
- 画像ノードに生成プロンプトを簡易表示する
- テキスト生成ノードに元の質問プロンプトを簡易表示する
- React Flow の `minZoom` / `maxZoom` を広げる

## Initial Technical Hypotheses

- `PromptBar` 内の画像生成完了後のプロンプトノード追加処理を削除すればよい。
- 生成時プロンプトは既存ノード data に任意項目として持たせ、既存 JSON との互換性を保てる。
- `CanvasArea` の `ReactFlow` に `minZoom` / `maxZoom` を渡すことでズーム範囲を変更できる。

## Uncertainties

- 簡易プロンプト表示のラベル文言（例: `Prompt` / `質問` / `生成プロンプト`）は未確定。本プランでは仮に `Prompt` とする。
- 表示行数は UX 上 2〜3 行程度が適切。本プランでは 3 行上限を仮置きする。

## Next Documents

1. `20_app_requirement.md`
2. `30_requirement.md`
3. `40_specification.md`
4. `50_review_notes.md`

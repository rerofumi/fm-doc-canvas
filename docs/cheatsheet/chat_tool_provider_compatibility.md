# Chat Tool Provider Compatibility

## Event ordering and lifecycle (2026-08-17)

- Wails eventの到着順は送信順と一致するとは限らない。backendはrun単位のmonotonic `sequence`を全stream/tool/terminal eventへ付与する。
- frontendはrun別bounded queueでsequence順にdrainし、pendingから処理したterminalでも必ずqueueを閉じる。
- duplicate/late eventはtombstoneで破棄し、legacy `sequence=0` eventは従来経路で処理する。
- gap expiryまたはoverflowでは該当runだけをerror terminalへ進め、local active run、matching Assistant operation、domain async run、backend Chatを一度だけ解放する。

OpenAI-compatible Chat Completions を agent tool loop に利用する際の provider 拡張 metadata の扱いを記録する。

## Google Gemini thought signatures

- Target: Google Gemini OpenAI compatibility endpoint、Gemini thinking model
- Confirmed: 2026-08-16
- Knowledge: 公式ドキュメント確認 + ローカル regression test
- Endpoint family: `https://generativelanguage.googleapis.com/v1beta/openai`

Gemini の function calling response は `tool_calls[]` に次の拡張を含むことがある。

```json
{
  "extra_content": {
    "google": {
      "thought_signature": "<opaque signature>"
    }
  }
}
```

同じ tool loop で tool result を返す次 request は、この `extra_content` を含む assistant tool call を受信時のまま再送しなければならない。署名を削除・変更すると Google API は HTTP 400 `Function call is missing a thought_signature` を返す。

OpenAI互換のcustom function resultは、assistant側の function call と同じ `id` を
`tool_call_id` に設定し、`name` に同じ関数名を設定して返す。`role=tool`、call/result の
順序、result content も保持する。Geminiの互換層はOpenAI schemaを内部のGemini形式へ
translationするため、OpenAI互換のフィールドが常に1:1で対応するとは限らない。

実装上は署名の中身を解釈せず、provider 固有 JSON metadata として透過保持する。他 provider が同じ `extra_content` に拡張を返した場合も保持する。

## Local verification

- Environment: Go tests、mock OpenAI-compatible SSE server
- Command: `mise x -- go test ./backend -run 'Test(AgentPreservesGeminiThoughtSignatureAcrossToolRound|GenerateOrchestrationProposalDoesNotCaptureConfiguredSystemPrompt)' -v -count=1`
- Expected: 1 round目の tool call に含まれる署名が、tool result とともに送る2 round目の assistant messageへ同値で含まれる。
- Confirmed result: pass（2026-08-16）。strict fake server は tool result の `id/name/order/content` 欠落を HTTP 400 として扱う。
- Failure condition: `extra_content` 欠落・改変、2 round目の HTTP 400。

Reference: [Gemini OpenAI compatibility](https://ai.google.dev/gemini-api/docs/openai)、
[function calling](https://ai.google.dev/gemini-api/docs/function-calling)、
[tools](https://ai.google.dev/gemini-api/docs/tools)（2026-08確認）。

再確認条件は、Google が OpenAI compatibility の署名フィールド形式を変更した時、または新しい tool-call metadata field を導入した時。

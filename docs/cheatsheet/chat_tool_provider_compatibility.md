# Chat Tool Provider Compatibility

OpenAI-compatible Chat Completions を agent tool loop に利用する際の provider 拡張 metadata の扱いを記録する。

## Google Gemini thought signatures

- Target: Google Gemini OpenAI compatibility endpoint、Gemini thinking model
- Confirmed: 2026-08-11
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

実装上は署名の中身を解釈せず、provider 固有 JSON metadata として透過保持する。他 provider が同じ `extra_content` に拡張を返した場合も保持する。

## Local verification

- Environment: Go tests、mock OpenAI-compatible SSE server
- Command: `mise x -- go test ./backend -run TestAgentPreservesGeminiThoughtSignatureAcrossToolRound -v -count=1`
- Expected: 1 round目の tool call に含まれる署名が、tool result とともに送る2 round目の assistant messageへ同値で含まれる。
- Confirmed result: pass（2026-08-11）
- Failure condition: `extra_content` 欠落・改変、2 round目の HTTP 400。

再確認条件は、Google が OpenAI compatibility の署名フィールド形式を変更した時、または新しい tool-call metadata field を導入した時。

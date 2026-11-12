# AI問答:換 Gemini 模型的切換機制與注意事項
- 起因:gpt-oss-120b 同題 27~57 秒。**答案正確優先**,品質差或編造就不換。
- 環境變數(全不設=與以前相同):`AI_BASE_URL_WECHAT`、`AI_MODEL_WECHAT`、金鑰依網址挑(Gemini 用 `GEMINI_API_KEY_SALES`,否則 `DEEPINFRA_API_KEY_SALES`,不會跨家送);選用 `AI_REASONING_EFFORT_WECHAT`(Gemini 2.5 設 none;回 400 自動拿掉重送)、`AI_PRICE_IN/OUT_WECHAT`。
- 範例:`AI_BASE_URL_WECHAT=https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`、`AI_MODEL_WECHAT=gemini-2.5-flash`。
- 陷阱:思考 token 算進 max_tokens(2000),沒關思考答案會被截斷(程式視為不合格重問);品保 10/08 曾見 Gemini 偶爾編數字。`node test/ai-switch-sim.js` 19 項通過但真實速度/品質未實測。

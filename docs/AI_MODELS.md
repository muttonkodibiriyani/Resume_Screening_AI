# AI model matrix

Current default models per provider. Used to make deprecation switching trivial.

## Google Gemini

| Slot | Model | Use case | Notes |
|------|-------|----------|-------|
| default | `gemini-2.5-flash` | scoring + benchmark generation | Fast, low cost, JSON-mode reliable. |
| auto fallback | `gemini-2.5-flash-lite` | scoring | Cheaper but smaller context. |
| latest stable | `gemini-2.5-pro` | benchmark generation when quality matters | Higher cost; throttled. |

Auto-detection probes `GET /v1beta/models?key=...` once per process (cache
30 min) and picks the first available model in the `FLASH_PREFERENCE` list.

If you want to pin manually:

```env
GOOGLE_GEMINI_MODEL=gemini-2.5-pro
```

## Azure OpenAI

| Deployment | Recommended base model | Use case |
|------------|-----------------------|----------|
| `recruit-scoring-prod` | `gpt-4o-mini` | scoring (default) |
| `recruit-benchmark-prod` | `gpt-4o` | benchmark generation |

Set:

```env
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://<your-resource>.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=recruit-scoring-prod
AZURE_OPENAI_API_VERSION=2024-10-21
```

## Switching providers

| Goal | Action |
|------|--------|
| Use AOAI for scoring | Set both `AZURE_OPENAI_*` and clear `GOOGLE_GEMINI_API_KEY`. |
| Use Gemini for scoring, AOAI for benchmarks | Set `BENCHMARK_AI_ENGINE=azure-openai` and `SCORING_AI_ENGINE=gemini`. |
| Disable AI completely | Clear both keys. Platform runs in deterministic local-rule mode. |

## Deprecation incident response

When a provider deprecates a model:

1. Check `Settings → Active engine → Resolved Gemini model` for the actual
   model in use.
2. Bump `GOOGLE_GEMINI_MODEL` to the next supported version OR let
   auto-detection pick it from `FLASH_PREFERENCE` (one process restart needed).
3. Re-score the latest day's candidates from the Insights → Recent failures
   list.

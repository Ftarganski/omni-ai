# Google Gemini Provider

Adapter for the Google Gemini API (`@omni-ai/provider-google`).

## Supported capabilities

| Feature    | Supported |
|------------|-----------|
| Chat       | ✓         |
| Streaming  | ✓         |
| Tool use   | ✓         |
| Vision     | ✓         |
| Embeddings | ✓         |

## Getting an API key

1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click **Get API key → Create API key**
3. Copy the key — it starts with `AIza`

**Free tier** (no credit card required):
- `gemini-2.0-flash` / `gemini-1.5-flash` — 15 RPM, 1 000 000 tokens/day
- `text-embedding-004` — 1 500 RPM, 100 requests/minute

## Environment variable

```bash
# .env
GOOGLE_API_KEY=AIza...
```

## Configuration

```yaml
# config/omni-ai.yaml
providers:
  - name: google
    type: google
    apiKey: ${GOOGLE_API_KEY}
    defaultModel: gemini-2.0-flash   # default if omitted
```

### Available models

| Model | Context | Best for |
|---|---|---|
| `gemini-2.0-flash` | 1M tokens | Fast responses, daily use (free tier) |
| `gemini-1.5-flash` | 1M tokens | Lightweight tasks (free tier) |
| `gemini-1.5-pro` | 2M tokens | Complex reasoning, large context |
| `gemini-2.5-pro` | 1M tokens | Advanced reasoning (paid) |
| `text-embedding-004` | — | Embeddings (768 dimensions) |

## With retry and fallback

```yaml
providers:
  - name: google
    type: google
    apiKey: ${GOOGLE_API_KEY}
    defaultModel: gemini-2.0-flash
    retry:
      maxRetries: 3
      initialDelayMs: 500
    fallback: openai          # routes to openai if google fails

  - name: openai
    type: openai
    apiKey: ${OPENAI_API_KEY}
    defaultModel: gpt-4o-mini
```

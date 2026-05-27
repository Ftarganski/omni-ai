# Groq Provider

Adapter for the Groq API (`type: groq` in `omni-ai.yaml`).

Groq runs open-source models on custom LPU hardware — responses are significantly faster than most cloud providers.

## Supported capabilities

| Feature    | Supported |
|------------|-----------|
| Chat       | ✓         |
| Streaming  | ✓         |
| Tool use   | ✓         |
| Vision     | ✗ (model-dependent) |
| Embeddings | ✗         |

## Getting an API key

1. Go to [Groq Console](https://console.groq.com)
2. **API Keys → Create API key**
3. Copy the key — it starts with `gsk_`

**Free tier**: generous RPM/TPD limits, no credit card required.

## Environment variable

```bash
# .env
GROQ_API_KEY=gsk_...
```

## Configuration

```yaml
# config/omni-ai.yaml
providers:
  - name: groq
    type: groq
    apiKey: ${GROQ_API_KEY}
    defaultModel: llama-3.3-70b-versatile   # default if omitted
```

### Available models

| Model | Context | Best for |
|---|---|---|
| `llama-3.3-70b-versatile` | 128k | General use, best quality |
| `llama-3.1-8b-instant` | 128k | Fast, lightweight tasks |
| `deepseek-r1-distill-llama-70b` | 128k | Reasoning / math |
| `mixtral-8x7b-32768` | 32k | Mixture-of-experts, long context |

## With retry and fallback

```yaml
providers:
  - name: groq
    type: groq
    apiKey: ${GROQ_API_KEY}
    retry:
      maxRetries: 3
      initialDelayMs: 500
    fallback: anthropic

  - name: anthropic
    type: anthropic
    apiKey: ${ANTHROPIC_API_KEY}
```

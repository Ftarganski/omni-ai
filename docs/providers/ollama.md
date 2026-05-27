# Ollama Provider

Adapter for [Ollama](https://ollama.com) — a local LLM runtime (`type: ollama` in `omni-ai.yaml`).

Runs models entirely on your machine. No API key, no usage costs, no data sent to external servers.

## Supported capabilities

| Feature    | Supported |
|------------|-----------|
| Chat       | ✓         |
| Streaming  | ✓         |
| Tool use   | ✓ (model-dependent) |
| Vision     | ✓ (model-dependent, e.g. llava, llama3.2-vision) |
| Embeddings | ✓ (e.g. nomic-embed-text) |

## Setup

1. Install Ollama: [https://ollama.com](https://ollama.com)
2. Pull a model:
   ```bash
   ollama pull llama3.2          # 3B, fast — good default
   ollama pull llama3.1          # 8B, better quality
   ollama pull qwen2.5           # strong reasoning
   ollama pull nomic-embed-text  # embeddings
   ```
3. Ollama starts automatically. Verify: `curl http://localhost:11434`

**No API key required.**

## Configuration

```yaml
# config/omni-ai.yaml
providers:
  - name: ollama
    type: ollama
    defaultModel: llama3.2   # default if omitted
    # baseUrl: http://localhost:11434/v1   # override if running on another host
```

### Popular models

| Model | Size | Best for |
|---|---|---|
| `llama3.2` | 3B | Fast local use (default) |
| `llama3.1` | 8B | Better quality, still fast |
| `qwen2.5` | 7B | Reasoning, multilingual |
| `phi4` | 14B | Code, instruction following |
| `deepseek-r1` | 7B–70B | Reasoning / math |
| `llava` | 7B | Vision (image analysis) |
| `nomic-embed-text` | — | Embeddings |

## Remote Ollama

If Ollama is running on a different machine or port:

```yaml
providers:
  - name: ollama
    type: ollama
    baseUrl: http://192.168.1.100:11434/v1
    defaultModel: llama3.1
```

## With fallback to a cloud provider

```yaml
providers:
  - name: ollama
    type: ollama
    defaultModel: llama3.2
    fallback: anthropic        # falls back if Ollama is not running

  - name: anthropic
    type: anthropic
    apiKey: ${ANTHROPIC_API_KEY}
```

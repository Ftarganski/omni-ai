# Provider: OpenAI

Implements `IProvider` for the OpenAI API (gpt-4o, gpt-4o-mini, etc.).

## Setup

```yaml
# config/omni-ai.yaml
providers:
  - name: openai
    type: openai
    apiKey: ${OPENAI_API_KEY}
    defaultModel: gpt-4o
```

## Environment

```
OPENAI_API_KEY=sk-...
```

## Package

```bash
pnpm add @omni-ai/provider-openai
```

# Provider: Anthropic

Implements `IProvider` for the Anthropic Claude API (claude-sonnet-4-6, claude-opus-4-7, etc.).

## Setup

```yaml
# config/omni-ai.yaml
providers:
  - name: anthropic
    type: anthropic
    apiKey: ${ANTHROPIC_API_KEY}
    defaultModel: claude-sonnet-4-6
```

## Environment

```
ANTHROPIC_API_KEY=sk-ant-...
```

## Package

```bash
pnpm add @omni-ai/provider-anthropic
```

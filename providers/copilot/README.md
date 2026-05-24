# Provider: GitHub Copilot

Implements `IProvider` for GitHub Copilot (via Copilot API or compatible endpoint).

## Setup

```yaml
# config/omni-ai.yaml
providers:
  - name: copilot
    type: copilot
    apiKey: ${GITHUB_TOKEN}
    baseUrl: https://api.githubcopilot.com
    defaultModel: gpt-4o
```

## Environment

```
GITHUB_TOKEN=ghp_...
```

## Package

```bash
pnpm add @omni-ai/provider-copilot
```

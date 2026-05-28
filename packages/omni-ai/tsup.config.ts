import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "skills/index": "src/skills/index.ts",
      "skills/fs": "src/skills/fs.ts",
      "skills/code": "src/skills/code.ts",
      "skills/ux": "src/skills/ux.ts",
      "skills/git": "src/skills/git.ts",
      "skills/http": "src/skills/http.ts",
      "skills/multimodal": "src/skills/multimodal.ts",
      "skills/backend": "src/skills/backend.ts",
      "skills/frontend": "src/skills/frontend.ts",
      "skills/qa": "src/skills/qa.ts",
      memory: "src/memory.ts",
      mcp: "src/mcp.ts",
      "provider-anthropic": "src/provider-anthropic.ts",
      "provider-openai": "src/provider-openai.ts",
      "provider-google": "src/provider-google.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    splitting: true,
    noExternal: [/^@omni-ai\//],
    tsconfig: "tsconfig.json",
  },
  {
    entry: {
      "cli/bin": "src/cli/bin.ts",
    },
    format: ["esm"],
    dts: false,
    noExternal: [/^@omni-ai\//],
    banner: { js: "#!/usr/bin/env node" },
  },
]);

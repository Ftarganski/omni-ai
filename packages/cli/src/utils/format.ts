import chalk from "chalk";

export function agentHeader(name: string, providerModel: string): string {
  return chalk.bold.cyan(`◆ ${name}`) + chalk.gray(`  [${providerModel}]`);
}

export function stepLine(skillName: string, detail?: string): string {
  const base = chalk.gray("  ↳ ") + chalk.yellow(skillName);
  return detail ? `${base}: ${chalk.dim(detail)}` : base;
}

export function tokenSummary(inputTokens: number, outputTokens: number): string {
  const cost = ((inputTokens * 3 + outputTokens * 15) / 1_000_000).toFixed(4);
  return chalk.gray(
    `Tokens: ${inputTokens.toLocaleString()} entrada · ${outputTokens.toLocaleString()} saída · ~$${cost}`
  );
}

export function iterationLine(n: number): string {
  return chalk.gray(`  ... (${n} iteraç${n === 1 ? "ão" : "ões"})`);
}

export function errorLine(message: string): string {
  return chalk.red(`✖ ${message}`);
}

export function savedLine(path: string): string {
  return chalk.green(`Output salvo em: ${path}`);
}

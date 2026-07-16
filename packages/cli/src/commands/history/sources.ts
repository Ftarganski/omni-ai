import chalk from "chalk";
import { buildHistoryRegistry } from "./shared.js";

interface SourcesOptions {
  json?: boolean;
}

export async function historySourcesCommand(opts: SourcesOptions): Promise<void> {
  const registry = buildHistoryRegistry();
  const sources = (await Promise.all(registry.list().map((p) => p.discover()))).flat();

  if (opts.json) {
    console.log(JSON.stringify({ sources }, null, 2));
    return;
  }

  if (sources.length === 0) {
    console.log(chalk.gray("No known providers registered."));
    return;
  }

  console.log(chalk.bold(`Sources (${sources.length}):\n`));
  for (const s of sources) {
    const status = s.importable ? chalk.green("importable") : chalk.yellow(`not importable (${s.reason})`);
    console.log(`  ${chalk.cyan(s.provider.padEnd(14))} ${s.path}`);
    console.log(`  ${" ".repeat(14)} scope=${s.scope ?? "(unscoped)"} native_import=${s.nativeImport} ${status}\n`);
  }
}

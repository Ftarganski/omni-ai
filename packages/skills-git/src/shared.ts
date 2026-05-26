import { spawn } from "node:child_process";

export function runGit(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, { cwd, shell: false });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    proc.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    proc.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(Buffer.concat(stderr).toString().trim() || `git ${args[0]} exited with code ${code}`));
      } else {
        resolve(Buffer.concat(stdout).toString());
      }
    });
    proc.on("error", reject);
  });
}

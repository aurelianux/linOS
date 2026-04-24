import { readFile } from "fs/promises";
import { Client, type ConnectConfig } from "ssh2";
import type pino from "pino";

const SSH_READY_TIMEOUT_MS = 10_000;
const SSH_EXEC_TIMEOUT_MS = 30_000;

export interface HostSshConfig {
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
  passphrase?: string;
  remoteRepoPath: string;
}

interface RunSshOptions {
  execTimeoutMs?: number;
  allowNonZeroExit?: boolean;
}

export interface SshExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

export async function runSshCommand(
  config: HostSshConfig,
  command: string,
  opts: RunSshOptions = {},
): Promise<SshExecResult> {
  const privateKey = await readFile(config.privateKeyPath, "utf-8");
  const execTimeoutMs = opts.execTimeoutMs ?? SSH_EXEC_TIMEOUT_MS;

  return new Promise<SshExecResult>((resolve, reject) => {
    const conn = new Client();
    let finished = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const finish = (result?: SshExecResult, err?: Error): void => {
      if (finished) return;
      finished = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      conn.end();
      if (err) { reject(err); return; }
      if (!result) { reject(new Error("SSH command finished without result")); return; }
      resolve(result);
    };

    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      privateKey,
      readyTimeout: SSH_READY_TIMEOUT_MS,
      ...(config.passphrase ? { passphrase: config.passphrase } : {}),
    };

    conn.on("ready", () => {
      timeoutHandle = setTimeout(
        () => finish(undefined, new Error("SSH command timed out")),
        execTimeoutMs,
      );

      conn.exec(command, (execError, stream) => {
        if (execError) { finish(undefined, execError); return; }

        let stdout = "";
        let stderr = "";
        stream.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
        stream.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
        stream.on("close", (code: number | null) => {
          const result: SshExecResult = { stdout: stdout.trim(), stderr: stderr.trim(), code };
          if (!opts.allowNonZeroExit && code !== 0) {
            finish(undefined, new Error(`Remote command exited with code ${code ?? -1}: ${stderr.trim()}`));
            return;
          }
          finish(result);
        });
      });
    });

    conn.on("error", (err: Error) => finish(undefined, err));
    conn.connect(connectConfig);
  });
}

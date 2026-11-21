import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mapPingFailure, parsePingLatency } from '../../utils/pingParser.js';

const execFileAsync = promisify(execFile);

export async function checkPing(monitor) {
  const timeoutSeconds = Math.max(1, Math.ceil(monitor.timeout_ms / 1000));
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'ping.exe' : 'ping';
  const args = isWindows
    ? ['-n', '1', '-w', String(monitor.timeout_ms), monitor.target]
    : ['-c', '1', '-W', String(timeoutSeconds), monitor.target];
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      timeout: monitor.timeout_ms,
      windowsHide: true
    });
    const latency = parsePingLatency(`${stdout}\n${stderr}`);
    if (latency === null) {
      const friendlyError = mapPingFailure(null, stdout, stderr);
      if (friendlyError === 'Ping failed' && process.env.NODE_ENV !== 'production') {
        console.error('[PING fallback]', {
          stdout,
          stderr,
          exitCode: 'no parsed reply'
        });
      }
      return {
        status: 'down',
        latency_ms: null,
        status_code: null,
        error: friendlyError
      };
    }
    return {
      status: 'up',
      latency_ms: Math.round(latency * 100) / 100,
      status_code: null,
      error: null
    };
  } catch (error) {
    const stdout = error.stdout || '';
    const stderr = error.stderr || '';
    const friendlyError = mapPingFailure(error, stdout, stderr);
    if (friendlyError === 'Ping failed' && process.env.NODE_ENV !== 'production') {
      console.error('[PING fallback]', {
        stdout,
        stderr,
        exitCode: error.code ?? null
      });
    }
    return {
      status: 'down',
      latency_ms: null,
      status_code: null,
      error: friendlyError
    };
  }
}

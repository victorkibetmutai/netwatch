import net from 'node:net';

export function checkTcp(monitor) {
  return new Promise((resolve) => {
    const startedAt = process.hrtime.bigint();
    const socket = net.createConnection({ host: monitor.target, port: monitor.port });
    let settled = false;
    let timer;

    const finish = (status, error = null) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      const latency = Number(process.hrtime.bigint() - startedAt) / 1e6;
      socket.destroy();
      resolve({
        status,
        latency_ms: status === 'up' ? Math.round(latency * 100) / 100 : null,
        status_code: null,
        error
      });
    };

    timer = setTimeout(() => finish('down', 'TCP connection timed out'), monitor.timeout_ms);
    socket.setTimeout(monitor.timeout_ms);
    socket.once('connect', () => {
      clearTimeout(timer);
      finish('up');
    });
    socket.once('timeout', () => {
      clearTimeout(timer);
      finish('down', 'TCP connection timed out');
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      finish('down', error.message || 'TCP connection failed');
    });
  });
}

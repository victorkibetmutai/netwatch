function parseSseBlock(block) {
  const lines = block.split('\n');
  let eventName = 'message';
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim());
    }
  }
  return dataLines.length > 0
    ? { eventName, data: dataLines.join('\n') }
    : null;
}

export function openLiveEvents(onEvent) {
  const token = localStorage.getItem('netwatch-token');
  let stopped = false;
  let reconnectTimer = null;

  async function connect() {
    if (stopped) return;

    const headers = { Accept: 'text/event-stream' };
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
      const response = await fetch('/api/events', { headers, cache: 'no-store' });
      if (response.status === 401) {
        localStorage.removeItem('netwatch-token');
        window.location.href = '/login.html';
        return;
      }
      if (!response.ok || !response.body) {
        throw new Error(`Event stream failed (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let separatorIndex = buffer.indexOf('\n\n');
        while (separatorIndex !== -1) {
          const block = buffer.slice(0, separatorIndex);
          buffer = buffer.slice(separatorIndex + 2);
          separatorIndex = buffer.indexOf('\n\n');

          const parsed = parseSseBlock(block);
          if (!parsed) continue;
          onEvent(parsed.eventName, parsed.data);
        }
      }
    } catch (error) {
      if (!stopped) {
        console.error('Live event stream disconnected:', error.message);
      }
    }

    if (!stopped) {
      reconnectTimer = setTimeout(connect, 3000);
    }
  }

  connect();
  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
  };
}

const clients = new Set();

export function addEventClient(response) {
  clients.add(response);
  response.on('close', () => clients.delete(response));
}

export function publishEvent(type, data) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const response of clients) {
    // A closed client may still remain briefly after a socket disconnect.
    if (response.writableEnded) {
      clients.delete(response);
      continue;
    }
    response.write(payload);
  }
}

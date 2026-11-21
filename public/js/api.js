export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('netwatch-token');
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(path, {
    ...options,
    headers
  });

  if (response.status === 204) return null;

  const body = await response.json().catch(() => ({ error: 'Invalid server response' }));
  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('netwatch-token');
      window.location.href = '/login.html';
    }
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

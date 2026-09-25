export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

export async function api(path: string, opts: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('ft_token') : null;
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(opts.headers || {}) },
    credentials: 'include',
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

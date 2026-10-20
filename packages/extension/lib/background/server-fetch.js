export const SERVER_URL = 'http://127.0.0.1:3846';

export async function serverFetch(url, init = {}) {
  const target = new URL(url, SERVER_URL);
  if (target.origin !== SERVER_URL) throw new Error('Invalid annotation server URL');
  const { pairingToken } = await chrome.storage.session.get('pairingToken');
  if (!pairingToken) throw new Error('Pair the server in the extension Options page first.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${pairingToken}`);
  return fetch(target.href, { ...init, headers, redirect: 'error' });
}

export async function pairServer(token) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Enter the 64-character token from vibe-annotations-server token.');
  const health = await fetch(`${SERVER_URL}/health`, { redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!health.ok || (await health.json()).authentication !== 'bearer') {
    throw new Error('Update the annotation server before pairing.');
  }
  const response = await fetch(`${SERVER_URL}/api/watchers`, {
    headers: { Authorization: `Bearer ${token}` },
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('Pairing failed. Check that the updated server is running and the token is correct.');
  // Session storage is restricted to trusted extension contexts. Never copy the
  // credential to local storage, a content script, a DOM attribute, or a URL.
  await chrome.storage.session.set({ pairingToken: token });
}

export async function attachmentDataUrl(id, attId) {
  const response = await serverFetch(`/api/annotations/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attId)}`);
  if (!response.ok) throw new Error(`attachment read failed: ${response.status}`);
  const mime = response.headers.get('Content-Type')?.split(';')[0];
  if (!/^image\/(png|jpeg|webp|gif|bmp|avif)$/.test(mime || '')) throw new Error('Unsupported image type');
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return `data:${mime};base64,${btoa(binary)}`;
}

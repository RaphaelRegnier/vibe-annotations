const query = new URLSearchParams(location.search);
const status = document.querySelector('#status');
try {
  const result = await chrome.runtime.sendMessage({ action: 'getAttachment', id: query.get('id'), attId: query.get('attId') });
  if (!result?.success) throw new Error(result?.error || 'Image unavailable.');
  const image = document.querySelector('#image');
  image.src = result.dataUrl;
  image.hidden = false;
  status.textContent = '';
} catch (error) {
  status.textContent = error.message;
}

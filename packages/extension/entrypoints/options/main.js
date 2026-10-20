const status = document.querySelector('#status');
const tokenInput = document.querySelector('#token');

chrome.storage.session.get('pairingToken').then(({ pairingToken }) => {
  status.textContent = pairingToken ? 'Paired for this browser session.' : 'Server is not paired.';
});

document.querySelector('#pair-form').addEventListener('submit', async event => {
  event.preventDefault();
  const token = tokenInput.value.trim();
  tokenInput.value = '';
  try {
    const result = await chrome.runtime.sendMessage({ action: 'pairServer', token });
    status.textContent = result?.success ? 'Paired for this browser session.' : result?.error || 'Pairing failed.';
  } catch (error) {
    status.textContent = error.message;
  }
});

document.querySelector('#disconnect').addEventListener('click', async () => {
  await chrome.storage.session.remove('pairingToken');
  tokenInput.value = '';
  status.textContent = 'Disconnected.';
});

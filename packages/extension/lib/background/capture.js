// activeTab is granted by the extension action/command. A page-toolbar click
// cannot grant it. Never capture the unrelated tab that happens to be active.
export async function captureSenderTab(sender) {
  const tab = sender?.tab;
  if (!tab?.id || sender.frameId !== 0) throw new Error('Capture requires the top-level annotation tab.');
  let changed = false;
  const onActivated = info => {
    if (info.windowId === tab.windowId && info.tabId !== tab.id) changed = true;
  };
  const onUpdated = (id, info) => {
    if (id === tab.id && (info.url || info.status === 'loading')) changed = true;
  };
  chrome.tabs.onActivated.addListener(onActivated);
  chrome.tabs.onUpdated.addListener(onUpdated);
  try {
    const [active] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (active?.id !== tab.id || changed) throw new Error('Activate the annotation tab before taking a screenshot.');
    let result;
    try {
      result = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
    } catch {
      throw new Error('Click the Vibe Annotations extension icon or its keyboard shortcut, then try the screenshot again.');
    }
    const [after] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (changed || after?.id !== tab.id || after.url !== active.url) throw new Error('The active tab changed during capture; screenshot discarded.');
    return result;
  } finally {
    chrome.tabs.onActivated.removeListener(onActivated);
    chrome.tabs.onUpdated.removeListener(onUpdated);
  }
}

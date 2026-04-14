// Background utilities — ID generation, changelog, migrations

export function generateId() {
  return 'vibe_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export async function migrateSyncFlags() {
  const result = await chrome.storage.local.get(['annotations', '_syncFlagsMigrated']);
  if (result._syncFlagsMigrated) return;
  const annotations = result.annotations || [];
  if (annotations.length) {
    let changed = false;
    for (const a of annotations) { if (!a._synced) { a._synced = true; changed = true; } }
    if (changed) await chrome.storage.local.set({ annotations });
  }
  await chrome.storage.local.set({ _syncFlagsMigrated: true });
}


const btn = document.getElementById('toggleBtn');
const statusDiv = document.getElementById('status');

chrome.storage.local.get('enabled', (data) => {
  updateUI(data.enabled || false);
});

btn.addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    
    if (!tab || !tab.url || !tab.url.includes('youtube.com')) {
      statusDiv.textContent = '⚠️ Open YouTube first!';
      return;
    }

    chrome.storage.local.get('enabled', (data) => {
      const newState = !data.enabled;
      chrome.storage.local.set({ enabled: newState });
      updateUI(newState);

      chrome.tabs.sendMessage(tab.id, { action: newState ? 'start' : 'stop' }, (response) => {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = '❌ Refresh YouTube page';
        } else {
          statusDiv.textContent = newState ? '✅ Active - Show hand!' : '❌ Disabled';
        }
      });
    });
  });
});

function updateUI(enabled) {
  btn.textContent = enabled ? '🛑 Disable Gestures' : '🎥 Enable Gestures';
  btn.className = enabled ? 'on' : 'off';
  if (!enabled) statusDiv.textContent = '';
}
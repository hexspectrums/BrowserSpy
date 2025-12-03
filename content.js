// Track user activity
let activityDetected = false;
let lastActivityTime = Date.now();
let lastScrollY = window.scrollY;

// Detect mouse movements
document.addEventListener('mousemove', (e) => {
  const movement = Math.abs(e.movementX) + Math.abs(e.movementY);
  if (movement > 50) { // Significant movement
    activityDetected = true;
    lastActivityTime = Date.now();
    
    // Notify background script
    chrome.runtime.sendMessage({
      type: 'USER_ACTIVITY'
    });
  }
});

// Detect clicks
document.addEventListener('click', () => {
  activityDetected = true;
  lastActivityTime = Date.now();
  chrome.runtime.sendMessage({
    type: 'USER_ACTIVITY'
  });
});

// Detect keyboard input
document.addEventListener('keydown', (e) => {
  // Ignore modifier keys
  if (e.key.length === 1 || e.key === 'Enter' || e.key === 'Tab' || e.key === 'Backspace') {
    activityDetected = true;
    lastActivityTime = Date.now();
    chrome.runtime.sendMessage({
      type: 'USER_ACTIVITY'
    });
  }
});

// Detect scrolling
window.addEventListener('scroll', () => {
  const currentScroll = window.scrollY;
  const scrollDiff = Math.abs(currentScroll - lastScrollY);
  
  if (scrollDiff > 100) { // Significant scroll
    chrome.runtime.sendMessage({
      type: 'SCROLL_CHANGE',
      scrollTop: currentScroll
    });
    lastScrollY = currentScroll;
  }
});

// Detect form interactions
document.addEventListener('input', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    activityDetected = true;
    lastActivityTime = Date.now();
    chrome.runtime.sendMessage({
      type: 'USER_ACTIVITY'
    });
  }
});

// Periodically check for activity
setInterval(() => {
  if (activityDetected && Date.now() - lastActivityTime < 1000) {
    activityDetected = false;
  }
}, 2000);
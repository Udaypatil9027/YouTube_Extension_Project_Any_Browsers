// ========== YouTube Controls ==========
function getVideo() {
  return document.querySelector('video.html5-main-video');
}

function togglePlayPause() {
  const v = getVideo();
  if (!v) return;
  if (v.paused) {
    v.play();
    showToast('▶️ Playing');
  } else {
    v.pause();
    showToast('⏸️ Paused');
  }
}

function skipAd() {
  const selectors = [
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-skip-ad-button',
    'button.ytp-ad-skip-button-modern',
    '.ytp-ad-overlay-close-button',
    '[aria-label="Skip"]',
    '[aria-label="Close"]',
    '.ytp-ad-dismiss-button',
    '.ytp-ad-overlay-close'
  ];
  
  for (const sel of selectors) {
    const btn = document.querySelector(sel);
    if (btn && btn.offsetParent !== null) {
      btn.click();
      showToast('⏭️ Ad Skipped!');
      return true;
    }
  }
  return false;
}

// ========== Ad Blocker ==========
function blockAds() {
  // Speed through and mute any ad
  setInterval(() => {
    const adShowing = document.querySelector('.ad-showing, .ytp-ad-player-overlay');
    const skipBtn = document.querySelector('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
    const video = getVideo();
    
    if (adShowing && video) {
      video.muted = true;
      video.playbackRate = 16;
      
      if (skipBtn) {
        skipBtn.click();
        setTimeout(() => {
          if (video && !document.querySelector('.ad-showing')) {
            video.muted = false;
            video.playbackRate = 1;
          }
        }, 500);
      }
    }
  }, 200);
  
  // Hide ad elements
  const style = document.createElement('style');
  style.textContent = `
    .ytp-ad-player-overlay,
    .ytp-ad-overlay-container,
    .video-ads,
    #masthead-ad,
    ytd-ad-slot-renderer,
    .ytp-ad-progress-list {
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

blockAds();

// ========== Gesture Detection ==========
let isRunning = false;
let videoElement = null;
let canvas = null;
let ctx = null;
let stream = null;
let animFrame = null;
let lastGesture = null;
let gestureStartTime = 0;
const HOLD_TIME = 500;
let triggered = false;
let stableCount = 0;
const STABLE_NEED = 3;
let lastFrameTime = 0;

// ========== Improved Skin Detection ==========
function isSkin(r, g, b) {
  // More lenient skin detection
  const sum = r + g + b;
  if (sum < 100 || sum > 700) return false;
  
  // RGB skin ranges
  if (r < 70 || g < 30 || b < 10) return false;
  if (r <= g || g <= b) return false;
  if (r - g < 8 || r - b < 8) return false;
  
  // Normalized RGB
  const rNorm = r / sum;
  const gNorm = g / sum;
  
  if (rNorm < 0.35 || rNorm > 0.55) return false;
  if (gNorm < 0.25 || gNorm > 0.42) return false;
  
  // Saturation check
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 15) return false;
  if ((max - min) / max > 0.7) return false;
  
  return true;
}

function getSkinPixels(data, w, h) {
  const pixels = [];
  
  for (let y = 0; y < h; y += 2) {
    for (let x = 0; x < w; x += 3) {
      const i = (y * w + x) * 4;
      if (isSkin(data[i], data[i+1], data[i+2])) {
        pixels.push({x, y});
      }
    }
  }
  
  return pixels;
}

// ========== Better Hand Analysis ==========
function analyzeHand(skin, w, h) {
  const count = skin.length;
  
  if (count < 200 || count > 12000) return null;
  
  let minX = w, maxX = 0, minY = h, maxY = 0;
  
  for (const p of skin) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  
  if (boxW < 20 || boxH < 20 || boxW > w * 0.85) return null;
  
  const aspect = boxW / boxH;
  const density = count / (boxW * boxH);
  
  // Analyze top region (fingers area)
  const topThird = minY + boxH * 0.33;
  let topCount = 0;
  
  for (const p of skin) {
    if (p.y < topThird) topCount++;
  }
  
  const topRatio = topCount / count;
  
  // Gap detection for peace sign
  let gaps = 0;
  
  if (topCount > 25) {
    const numCols = Math.max(4, Math.floor(boxW / 5));
    const colW = boxW / numCols;
    const colCounts = new Array(numCols).fill(0);
    const scanLimit = minY + boxH * 0.45;
    
    for (const p of skin) {
      if (p.y < scanLimit) {
        const col = Math.floor((p.x - minX) / colW);
        if (col >= 0 && col < numCols) colCounts[col]++;
      }
    }
    
    let inGap = false;
    for (let i = 0; i < numCols; i++) {
      if (colCounts[i] < 2) {
        if (!inGap) { gaps++; inGap = true; }
      } else {
        inGap = false;
      }
    }
  }
  
  // ✌️ PEACE SIGN: 2-3 clear gaps
  if (gaps >= 2 && gaps <= 3 && topRatio > 0.08 && topRatio < 0.4 && aspect > 0.6 && aspect < 2.2) {
    return 'peace';
  }
  
  // 🖐️ OPEN PALM: Wide aspect ratio OR many gaps (spread fingers)
  // Made more lenient for better detection
  if (
    (aspect > 1.05 && density < 0.72 && topRatio < 0.48) ||
    (aspect > 0.75 && density < 0.55 && gaps >= 4) ||
    (aspect > 1.0 && topRatio < 0.42 && density < 0.68)
  ) {
    return 'open_palm';
  }
  
  return null;
}

// ========== Trigger ==========
function handleGesture(gesture) {
  const now = Date.now();
  
  if (gesture !== lastGesture) {
    lastGesture = gesture;
    gestureStartTime = now;
    triggered = false;
    stableCount = 0;
    return;
  }
  
  stableCount++;
  
  if (!triggered && stableCount >= STABLE_NEED && (now - gestureStartTime > HOLD_TIME)) {
    triggered = true;
    
    if (gesture === 'peace') {
      togglePlayPause();
    } else if (gesture === 'open_palm') {
      skipAd();
    }
    
    stableCount = 0;
  }
}

// ========== Camera Setup ==========
async function startCamera() {
  console.log('🎥 Starting camera...');
  
  // Create hidden video element
  videoElement = document.createElement('video');
  videoElement.setAttribute('playsinline', '');
  videoElement.setAttribute('autoplay', '');
  videoElement.style.cssText = 'display:none;';
  document.body.appendChild(videoElement);
  
  // Create overlay container
  const overlay = document.createElement('div');
  overlay.id = 'gesturetube-overlay';
  overlay.style.cssText = `
    position: fixed !important;
    bottom: 80px !important;
    right: 20px !important;
    width: 220px !important;
    height: 165px !important;
    border: 3px solid #00ff00 !important;
    border-radius: 15px !important;
    z-index: 2147483647 !important;
    background: #111 !important;
    overflow: hidden !important;
    box-shadow: 0 6px 25px rgba(0,0,0,0.7) !important;
    cursor: move !important;
  `;
  
  // Status label
  const status = document.createElement('div');
  status.id = 'gesturetube-status';
  status.style.cssText = `
    position: absolute !important;
    top: 6px !important;
    left: 8px !important;
    color: #00ff00 !important;
    font-size: 11px !important;
    font-family: Arial, sans-serif !important;
    z-index: 3 !important;
    background: rgba(0,0,0,0.8) !important;
    padding: 3px 10px !important;
    border-radius: 12px !important;
    font-weight: bold !important;
    pointer-events: none !important;
  `;
  status.textContent = '📷 Starting...';
  overlay.appendChild(status);
  
  // Guide label
  const guide = document.createElement('div');
  guide.id = 'gesturetube-guide';
  guide.style.cssText = `
    position: absolute !important;
    bottom: 6px !important;
    left: 50% !important;
    transform: translateX(-50%) !important;
    color: #fff !important;
    font-size: 10px !important;
    font-family: Arial, sans-serif !important;
    z-index: 3 !important;
    background: rgba(0,0,0,0.8) !important;
    padding: 3px 10px !important;
    border-radius: 12px !important;
    white-space: nowrap !important;
    pointer-events: none !important;
  `;
  guide.textContent = '✌️ Play/Pause | 🖐️ Skip Ad';
  overlay.appendChild(guide);
  
  // Canvas for drawing
  canvas = document.createElement('canvas');
  canvas.width = 220;
  canvas.height = 165;
  canvas.style.cssText = 'width:100% !important; height:100% !important; display:block !important;';
  overlay.appendChild(canvas);
  
  document.body.appendChild(overlay);
  ctx = canvas.getContext('2d');
  
  // Make draggable
  makeDraggable(overlay);
  
  // Request camera
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { 
        width: { ideal: 320 }, 
        height: { ideal: 240 },
        facingMode: 'user'
      },
      audio: false
    });
    
    videoElement.srcObject = stream;
    
    // Wait for video to be ready
    await new Promise((resolve) => {
      videoElement.onloadedmetadata = () => {
        videoElement.play().then(resolve);
      };
    });
    
    console.log('✅ Camera ready');
    document.getElementById('gesturetube-status').textContent = '🟢 Ready';
    isRunning = true;
    processFrames();
    
  } catch (err) {
    console.error('Camera error:', err);
    alert('Camera access is required!\n\nPlease allow camera permission and reload the page.');
    stopCamera();
  }
}

function processFrames() {
  if (!isRunning) return;
  
  const frame = () => {
    if (!isRunning || !videoElement || !ctx) {
      animFrame = requestAnimationFrame(frame);
      return;
    }
    
    const now = Date.now();
    // Process at ~25 FPS for smooth display
    if (now - lastFrameTime < 40) {
      animFrame = requestAnimationFrame(frame);
      return;
    }
    lastFrameTime = now;
    
    try {
      if (videoElement.readyState >= 2) {
        // Clear canvas
        ctx.clearRect(0, 0, 220, 165);
        
        // Draw camera feed MIRRORED
        ctx.save();
        ctx.scale(-1, 1);
        ctx.drawImage(videoElement, -220, 0, 220, 165);
        ctx.restore();
        
        // Get image data for skin detection
        const imageData = ctx.getImageData(0, 0, 220, 165);
        const skin = getSkinPixels(imageData.data, 220, 165);
        
        // Draw green overlay on skin
        if (skin.length > 0) {
          ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
          for (let i = 0; i < skin.length; i += 2) {
            const p = skin[i];
            ctx.fillRect(220 - p.x, p.y, 3, 3);
          }
        }
        
        // Analyze gesture
        const gesture = analyzeHand(skin, 220, 165);
        const statusEl = document.getElementById('gesturetube-status');
        const guideEl = document.getElementById('gesturetube-guide');
        
        if (gesture) {
          handleGesture(gesture);
          
          if (statusEl) {
            statusEl.textContent = gesture === 'peace' ? '✌️ Peace Sign' : '🖐️ Open Palm';
            statusEl.style.color = gesture === 'peace' ? '#00ff00' : '#FFD700';
          }
          
          if (guideEl) {
            guideEl.textContent = gesture === 'peace' ? 'HOLD → Play/Pause' : 'HOLD → Skip Ad';
          }
          
          // Draw big emoji indicator
          ctx.font = 'bold 30px Arial';
          ctx.fillStyle = gesture === 'open_palm' ? '#FFD700' : '#00ff00';
          ctx.strokeStyle = '#000';
          ctx.lineWidth = 4;
          const em = gesture === 'peace' ? '✌️' : '🖐️';
          ctx.strokeText(em, 12, 145);
          ctx.fillText(em, 12, 145);
          
        } else {
          lastGesture = null;
          stableCount = 0;
          
          if (statusEl) {
            if (skin.length > 500) {
              statusEl.textContent = '🔍 Analyzing...';
              statusEl.style.color = '#FFA500';
            } else if (skin.length > 100) {
              statusEl.textContent = '👋 Move closer';
              statusEl.style.color = '#FFD700';
            } else {
              statusEl.textContent = '❌ No hand';
              statusEl.style.color = '#ff4444';
            }
          }
          
          if (guideEl) {
            guideEl.textContent = 'Show hand clearly';
          }
        }
        
        // Draw bounding box
        if (skin.length > 200) {
          let minX = 220, maxX = 0, minY = 165, maxY = 0;
          for (let i = 0; i < skin.length; i += 3) {
            const p = skin[i];
            if (p.x < minX) minX = p.x;
            if (p.x > maxX) maxX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.y > maxY) maxY = p.y;
          }
          
          ctx.strokeStyle = '#00ff00';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 3]);
          ctx.strokeRect(220 - maxX, minY, maxX - minX, maxY - minY);
          ctx.setLineDash([]);
        }
      }
    } catch (err) {
      // Silent catch
    }
    
    animFrame = requestAnimationFrame(frame);
  };
  
  frame();
}

function stopCamera() {
  console.log('Stopping camera...');
  isRunning = false;
  
  if (animFrame) {
    cancelAnimationFrame(animFrame);
    animFrame = null;
  }
  
  if (stream) {
    stream.getTracks().forEach(t => t.stop());
    stream = null;
  }
  
  if (videoElement) {
    videoElement.remove();
    videoElement = null;
  }
  
  const overlay = document.getElementById('gesturetube-overlay');
  if (overlay) overlay.remove();
  
  const toast = document.getElementById('gesturetube-toast');
  if (toast) toast.remove();
  
  lastGesture = null;
  stableCount = 0;
}

// ========== Toast ==========
function showToast(msg) {
  const existing = document.getElementById('gesturetube-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.id = 'gesturetube-toast';
  toast.textContent = msg;
  toast.style.cssText = `
    position: fixed !important;
    top: 80px !important;
    right: 20px !important;
    background: rgba(0,0,0,0.9) !important;
    color: #fff !important;
    padding: 12px 24px !important;
    border-radius: 25px !important;
    font-size: 16px !important;
    font-weight: bold !important;
    z-index: 2147483647 !important;
    font-family: Arial, sans-serif !important;
    pointer-events: none !important;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 1000);
}

// ========== Draggable ==========
function makeDraggable(el) {
  let a=0, b=0, c=0, d=0;
  
  el.onmousedown = function(e) {
    if (e.target.id === 'gesturetube-status' || e.target.id === 'gesturetube-guide') return;
    e.preventDefault();
    c = e.clientX;
    d = e.clientY;
    document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
    document.onmousemove = function(e) {
      e.preventDefault();
      a = c - e.clientX;
      b = d - e.clientY;
      c = e.clientX;
      d = e.clientY;
      el.style.top = (el.offsetTop - b) + 'px';
      el.style.left = (el.offsetLeft - a) + 'px';
      el.style.bottom = 'auto';
      el.style.right = 'auto';
    };
  };
}

// ========== Messages ==========
chrome.runtime.onMessage.addListener((req, s, res) => {
  if (req.action === 'start') {
    if (!isRunning) startCamera();
    res({ok: true});
  } else if (req.action === 'stop') {
    if (isRunning) stopCamera();
    res({ok: true});
  }
  return true;
});

// Auto-start
chrome.storage.local.get('enabled', (d) => {
  if (d.enabled && location.pathname.startsWith('/watch')) {
    setTimeout(startCamera, 1500);
  }
});

console.log('✅ GestureTube Ready! ✌️=Play/Pause | 🖐️=Skip Ad');
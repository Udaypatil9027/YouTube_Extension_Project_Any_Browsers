
### File Descriptions

#### `manifest.json`
- Extension metadata and permissions
- Content script injection rules
- Manifest V3 compliant

#### `popup.html`
- Clean, responsive UI
- UTF-8 encoded for proper emoji display
- Gradient background design

#### `popup.js`
- Handles ON/OFF toggle
- Communicates with content script via Chrome messages
- Persists user preferences

#### `content.js` (~400 lines)
- **Core Modules**:
  - YouTube DOM controls
  - Webcam initialization
  - Skin detection algorithm
  - Gesture classification
  - Ad blocker system
  - Visual overlay rendering

---

## 🚀 Installation

### Method 1: Chrome Web Store (Recommended)

> Coming soon! Will be available on Chrome Web Store.

### Method 2: Manual Installation (Developer Mode)

1. **Download the project**
   ```bash
   git clone https://github.com/Udaypatil9027/YouTube_Extension_For_Any_Browser
2 **Open Chrome Extensions**

text
Navigate to: chrome://extensions/

3 **Enable Developer Mode**

Toggle the switch in top-right corner

4 **Load the extension**

Click "Load unpacked"

Select the GestureTube folder

Extension icon appears in toolbar

5 **Start using!**

Go to any YouTube video

Click the extension icon

Press "Enable Gestures"

Allow camera permission

Show your hand to the camera!


💻 **How It Works**

Gesture Detection Algorithm

┌─────────────────────────────────────────────┐
│           Frame Capture (25 FPS)             │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│         Skin Pixel Detection                 │
│  • Check RGB values                         │
│  • Apply skin color ranges                  │
│  • Filter non-skin pixels                   │
│  • Sample every 3rd pixel for speed         │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│         Bounding Box Analysis                │
│  • Find hand boundaries                     │
│  • Calculate aspect ratio                   │
│  • Compute pixel density                    │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│         Gap Detection                        │
│  • Split top region into columns            │
│  • Count pixels in each column              │
│  • Identify gaps between fingers            │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│         Gesture Classification               │
│  ✌️ Peace: 2-3 gaps + specific aspect ratio │
│  🖐️ Palm:  4+ gaps OR wide aspect + low     │
│             density                          │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│         Action Trigger                       │
│  • Wait for 3 stable frames                 │
│  • Hold duration: 500ms                     │
│  • Execute YouTube action                   │
└─────────────────────────────────────────────┘







  

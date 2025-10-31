# 🚀 TheBot Dashboard - Setup Instructions

Welcome! This is a **desktop application** that runs in Electron (not in your browser).

---

## ⚡ Quick Start (3 Steps)

### 1️⃣ Extract the ZIP
   - Unzip `TheBot-Dashboard.zip` to your desired location
   - Recommended: `~/Documents/TheBot-Dashboard/`

### 2️⃣ Install Node.js (if you don't have it)
   - Visit: https://nodejs.org/
   - Download and install the **LTS version** (v18 or higher)
   - Restart your Terminal after installation

### 3️⃣ Launch the App
   - Open the extracted folder
   - **Double-click** `TheBot-Dashboard.command`
   - The app will:
     - ✅ Auto-install dependencies (first time only)
     - ✅ Auto-build the application
     - ✅ Launch in Electron (desktop window)

**That's it!** 🎉

---

## 📱 What Happens on First Launch

When you first run `TheBot-Dashboard.command`, you'll see:

```
🚀 Starting TheBot Dashboard...

🔍 Checking prerequisites...
✅ Node.js v18.17.0 found
✅ npm 9.8.1 found

📦 Dependencies not found. Installing...
[Installing packages... this takes 1-2 minutes]

✅ Dependencies installed successfully!

🔨 Building application for first time...
[Building... this takes 30 seconds]

✅ Build completed successfully!

🎉 Launching TheBot Dashboard...
```

The dashboard will open in a **desktop window** (Electron app).

---

## 🔄 Subsequent Launches

After the first time, launching is **instant**:

```
🚀 Starting TheBot Dashboard...

✅ Dependencies already installed
✅ Application already built

🎉 Launching TheBot Dashboard...
```

Opens in **2-3 seconds**! ⚡

---

## 🖥️ Electron vs Browser

### ✅ This runs in **Electron** (Desktop App):
- Standalone desktop application
- Better performance for large datasets
- Can handle 10,000+ threads without crashing
- 8GB memory limit (vs 2GB in browser)
- No need to keep Terminal/browser open
- Optimized for your use case

### ❌ Not running in localhost:3000:
- This is NOT a web server
- This is NOT running in Chrome/Firefox/Safari
- It's a native desktop application (like Slack, VS Code, Discord)

---

## 💻 System Requirements

- **Operating System**: macOS 10.13+ (High Sierra or later)
- **Node.js**: v16 or higher (v18+ recommended)
- **npm**: Comes automatically with Node.js
- **Disk Space**: ~500MB (includes dependencies)
- **RAM**: 2GB minimum, 4GB+ recommended for large datasets

---

## 🔍 Checking if Node.js is Installed

Open Terminal and run:

```bash
node --version
npm --version
```

**Expected output:**
```
v18.17.0  (or similar)
9.8.1     (or similar)
```

**If you see "command not found":**
- Node.js is not installed
- Install from: https://nodejs.org/
- Choose the **LTS version** (green button)

---

## 🛠️ Troubleshooting

### Problem: "Permission denied" when running the launcher

**Solution:**
```bash
chmod +x TheBot-Dashboard.command
```

Then double-click it again.

---

### Problem: macOS asks "Are you sure you want to open it?"

This is normal for `.command` files.

**Solution:**
1. Right-click on `TheBot-Dashboard.command`
2. Select "Open"
3. Click "Open" in the dialog
4. Future launches won't ask

---

### Problem: Double-clicking opens in text editor instead of Terminal

**Solution:**
1. Right-click → Get Info
2. Open with: Terminal
3. Click "Change All..."

Or just run it from Terminal:
```bash
cd /path/to/extracted/folder
./TheBot-Dashboard.command
```

---

### Problem: "Node.js is not installed" error

**Solution:**
1. Install Node.js from https://nodejs.org/
2. Download the **LTS version** (Long Term Support)
3. Run the installer
4. **Restart Terminal** (important!)
5. Run `TheBot-Dashboard.command` again

---

### Problem: Build fails or errors during installation

**Common causes:**
- Not enough disk space (need ~500MB)
- Node.js version too old (need v16+)
- Corrupted download

**Solution:**
1. Check disk space: At least 500MB free
2. Check Node.js version: `node --version` (should be v16+)
3. Delete `node_modules` folder if it exists
4. Run `TheBot-Dashboard.command` again (it will reinstall)

---

### Problem: App crashes with large datasets

**This shouldn't happen anymore!** The app is optimized for large datasets.

If it still crashes:
1. Close the app
2. Delete the `node_modules` folder
3. Run `TheBot-Dashboard.command` (reinstalls with latest optimizations)

---

### Problem: Old instance still running

**Solution:**
```bash
pkill -f electron
```

Then launch again.

---

## 📂 What's Included in the ZIP

```
TheBot-Dashboard/
├── TheBot-Dashboard.command    ← Double-click this!
├── package.json                ← Dependencies list
├── src/                        ← React app source code
├── electron/                   ← Electron configuration
├── PERFORMANCE_OPTIMIZATIONS.md ← Technical details
├── UI_FIXES.md                 ← Recent improvements
└── README.md                   ← General info
```

**NOT included** (auto-installed by launcher):
- `node_modules/` (auto-installed, ~300MB)
- `dist/` (auto-built)
- `dist-electron/` (auto-built)

---

## 🎯 What the Launcher Does

The `TheBot-Dashboard.command` script automatically:

1. ✅ Checks if Node.js is installed
2. ✅ Checks if dependencies are installed
3. ✅ Installs dependencies if missing (`npm install`)
4. ✅ Checks if app is built
5. ✅ Builds app if needed (`npm run build`)
6. ✅ Detects source code changes and rebuilds
7. ✅ Cleans up old processes
8. ✅ Launches the Electron app

**All automatic!** You just double-click and it handles everything.

---

## 🔐 Data Security

✅ **100% Local** - All data stays on your computer  
✅ **No internet required** - Works completely offline  
✅ **No cloud storage** - Nothing sent to external servers  
✅ **Sensitive data safe** - Perfect for confidential information  

---

## 📊 Performance Features

- **Handles 10,000+ threads** without crashing
- **8GB memory limit** (vs 2GB in regular browsers)
- **Optimized rendering** with React.memo and virtualization
- **SQLite database** for efficient data storage
- **GPU acceleration** for smooth scrolling
- **60fps performance** even with large datasets

---

## 🆘 Getting Help

If you encounter issues:

1. **Check the troubleshooting section above** ↑
2. Check `PERFORMANCE_OPTIMIZATIONS.md` for technical details
3. Verify Node.js is v16 or higher: `node --version`
4. Try deleting `node_modules` and running the launcher again

---

## 🎊 You're All Set!

Just double-click `TheBot-Dashboard.command` and you're ready to analyze chatbot conversations!

The app will open in a desktop window with all features ready to use:
- 📊 Dashboard with thread overview
- 🔍 Conversation search
- 💾 Saved chats
- 📈 Statistics and analytics
- 🎨 Beautiful, responsive UI

Enjoy! 🚀


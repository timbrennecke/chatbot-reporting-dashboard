# Security Instructions for Mac Apps

When you download the Mac installer apps (`Simple Installer.app` or `Chatbot Dashboard Installer.app`), macOS may block them because they're not signed with an Apple Developer certificate. Here's how to safely run them:

## 🔒 Why is this happening?

macOS has a security feature called **Gatekeeper** that prevents running apps from "unidentified developers" to protect your computer. Since these installers aren't signed with an Apple Developer certificate (which costs $99/year), they're blocked by default.

## ✅ How to safely run the installers:

### Method 1: Right-click to open (Recommended)
1. **Download** the installer app (`Simple Installer.app` or `Chatbot Dashboard Installer.app`)
2. **Right-click** (or Control+click) on the app
3. Select **"Open"** from the context menu
4. Click **"Open"** in the security dialog that appears
5. The app will run normally

### Method 2: System Preferences bypass
1. **Try to open** the app normally (double-click)
2. You'll see a security warning
3. Go to **System Preferences** → **Security & Privacy** → **General**
4. You'll see a message about the blocked app
5. Click **"Open Anyway"**
6. Confirm by clicking **"Open"**

### Method 3: Terminal bypass (Advanced users)
```bash
# Remove the quarantine attribute from the app
xattr -d com.apple.quarantine "Simple Installer.app"
# or
xattr -d com.apple.quarantine "Chatbot Dashboard Installer.app"
```

## 🛡️ Is this safe?

**YES!** These installers are safe because:
- ✅ All source code is open and visible in the GitHub repository
- ✅ The installers only download and run official software (Node.js, Git, the dashboard)
- ✅ They don't modify system files or install anything harmful
- ✅ You can inspect the installer scripts before running them

## 🚨 Important Security Notes:

- **Only download** these apps from the official GitHub repository
- **Never download** similar apps from unknown sources
- **Always verify** you're downloading from the correct repository URL
- **Check the file** before running if you're unsure

## 📱 Alternative Installation Methods:

If you prefer not to bypass the security warnings, you can use these alternatives:

### Terminal Installation (No security warnings):
```bash
# One-liner installation
curl -fsSL https://raw.githubusercontent.com/timbrennecke/chatbot-reporting-dashboard/main/easy-install.sh | bash
```

### Manual Download and Run:
```bash
# Download and run the script manually
curl -fsSL https://raw.githubusercontent.com/timbrennecke/chatbot-reporting-dashboard/main/deploy.sh -o installer.sh
chmod +x installer.sh
./installer.sh
```

## 🏢 For Organizations:

If you're distributing this within an organization, consider:
1. **Code signing** with your organization's Apple Developer certificate
2. **Internal distribution** through your IT department
3. **Documentation** for users on how to safely bypass security warnings
4. **Using the terminal installation** methods instead of the app bundles

## ❓ Need Help?

If you encounter any issues with the security bypass:
1. Check that you downloaded from the official repository
2. Try the alternative terminal installation methods
3. Contact your IT administrator if in a corporate environment
4. Refer to Apple's official documentation on Gatekeeper

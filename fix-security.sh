#!/bin/bash

# Script to fix macOS security warnings for the installer apps
# This removes the quarantine attribute that causes Gatekeeper to block the apps

echo "🔓 Fixing macOS Security Warnings for Chatbot Dashboard Installers"
echo "=================================================================="
echo ""

# Function to fix an app
fix_app() {
    local app_name="$1"
    if [ -d "$app_name" ]; then
        echo "🔧 Fixing $app_name..."
        xattr -d com.apple.quarantine "$app_name" 2>/dev/null || true
        echo "✅ $app_name is now safe to open"
    else
        echo "⚠️  $app_name not found in current directory"
    fi
}

# Check current directory
echo "📁 Checking current directory: $(pwd)"
echo ""

# Fix both installer apps
fix_app "Chatbot Dashboard Installer.app"
fix_app "Chatbot Dashboard Launcher.app"

echo ""
echo "🎉 Security fix complete!"
echo ""
echo "You can now double-click the installer apps to run them normally."
echo "No more security warnings should appear."
echo ""
echo "💡 Note: You only need to run this script once after downloading the apps."

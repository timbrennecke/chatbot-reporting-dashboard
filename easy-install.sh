#!/bin/bash

# Easy Install Script for Chatbot Dashboard
# This script downloads and sets up the installer with proper permissions

echo "🚀 Chatbot Dashboard Easy Installer"
echo "===================================="
echo ""

# Download the main deploy script
echo "📥 Downloading installer..."
if curl -fsSL https://raw.githubusercontent.com/timbrennecke/chatbot-reporting-dashboard/main/deploy.sh -o chatbot-installer.sh; then
    # Make it executable
    chmod +x chatbot-installer.sh
    
    echo "✅ Download complete!"
    echo ""
    echo "🎯 Starting installation..."
    echo ""
    
    # Run the installer
    ./chatbot-installer.sh
else
    echo "❌ Download failed! Please check your internet connection and try again."
    echo ""
    echo "Alternative: Download manually from:"
    echo "https://github.com/timbrennecke/chatbot-reporting-dashboard"
    exit 1
fi

# Clean up
rm -f chatbot-installer.sh

echo ""
echo "🧹 Cleanup complete!"

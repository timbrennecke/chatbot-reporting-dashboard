#!/bin/bash

# Easy Install Script for Chatbot Dashboard
# This script downloads and sets up the installer with proper permissions

echo "🚀 Chatbot Dashboard Easy Installer"
echo "===================================="
echo ""

# Download the main deploy script
echo "📥 Downloading installer..."
curl -fsSL https://raw.githubusercontent.com/timbrennecke/chatbot-reporting-dashboard/main/deploy.sh -o chatbot-installer.sh

# Make it executable
chmod +x chatbot-installer.sh

echo "✅ Download complete!"
echo ""
echo "🎯 Starting installation..."
echo ""

# Run the installer
./chatbot-installer.sh

# Clean up
rm -f chatbot-installer.sh

echo ""
echo "🧹 Cleanup complete!"

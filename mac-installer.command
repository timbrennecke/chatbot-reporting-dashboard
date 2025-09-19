#!/bin/bash

# Chatbot Dashboard Mac Installer (.command file)
# This file can be double-clicked on Mac without security warnings

# Clear the screen for a clean start
clear

echo ""
echo "🚀 Chatbot Dashboard Installer for Mac"
echo "======================================"
echo ""
echo "This installer will download and set up the Chatbot Reporting Dashboard."
echo ""

# Function to check prerequisites
check_prereqs() {
    local missing=""
    
    if ! command -v git >/dev/null 2>&1; then
        missing="${missing}- Git\n"
    fi
    
    if ! command -v node >/dev/null 2>&1; then
        missing="${missing}- Node.js v18+\n"
    elif [ "$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)" -lt 18 ]; then
        missing="${missing}- Node.js v18+ (current version is too old)\n"
    fi
    
    if ! command -v npm >/dev/null 2>&1; then
        missing="${missing}- npm\n"
    fi
    
    echo "$missing"
}

# Function to show installation instructions
show_install_instructions() {
    echo "📋 Missing Prerequisites Detected"
    echo "================================"
    echo ""
    echo "The following software needs to be installed:"
    echo -e "$1"
    echo ""
    echo "🍺 EASIEST METHOD - Install using Homebrew:"
    echo "1. Copy and paste this command in Terminal:"
    echo "   /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
    echo ""
    echo "2. After Homebrew installation, run:"
    echo "   brew install git node"
    echo ""
    echo "💻 ALTERNATIVE - Manual Installation:"
    echo "• Git: https://git-scm.com/downloads"
    echo "• Node.js: https://nodejs.org/"
    echo ""
    echo "✅ After installing the prerequisites:"
    echo "• Double-click this installer again"
    echo "• Or run: curl -fsSL https://raw.githubusercontent.com/timbrennecke/chatbot-reporting-dashboard/main/easy-install.sh | bash"
    echo ""
}

# Function to install the dashboard
install_dashboard() {
    echo "✅ All prerequisites found! Starting installation..."
    echo ""
    
    # Download and run the installer
    if curl -fsSL https://raw.githubusercontent.com/timbrennecke/chatbot-reporting-dashboard/main/deploy.sh | bash; then
        echo ""
        echo "🎉 Installation completed successfully!"
        echo ""
        echo "The Chatbot Dashboard should now be running in your browser."
        echo "If it didn't open automatically, visit: http://localhost:3000"
        echo ""
    else
        echo ""
        echo "❌ Installation failed. Please try the manual installation:"
        echo "   curl -fsSL https://raw.githubusercontent.com/timbrennecke/chatbot-reporting-dashboard/main/deploy.sh | bash"
        echo ""
    fi
}

# Main execution
main() {
    # Check for prerequisites
    missing=$(check_prereqs)
    
    if [ -n "$missing" ]; then
        show_install_instructions "$missing"
        
        echo "Press any key to exit..."
        read -n 1 -s
        exit 0
    else
        install_dashboard
    fi
    
    echo "Press any key to exit..."
    read -n 1 -s
}

# Run the installer
main

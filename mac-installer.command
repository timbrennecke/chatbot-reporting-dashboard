#!/bin/bash

# Chatbot Dashboard Mac Installer (.command file)
# This file can be double-clicked on Mac without security warnings

# Clear the screen for a clean start
clear

# Configuration
REPO_URL="https://github.com/timbrennecke/chatbot-reporting-dashboard.git"
APP_NAME="chatbot-reporting-dashboard"
INSTALL_DIR="${HOME}/Desktop/${APP_NAME}"

echo ""
echo "🚀 Chatbot Dashboard Installer for Mac"
echo "======================================"
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

# Function to check if dashboard is already installed
check_existing_installation() {
    if [ -d "$INSTALL_DIR" ] && [ -f "$INSTALL_DIR/package.json" ]; then
        return 0  # Installation exists
    else
        return 1  # No installation found
    fi
}

# Function to check for updates
check_for_updates() {
    echo "🔍 Checking for updates..."
    echo ""
    
    if ! check_existing_installation; then
        echo "❌ No existing installation found. Please install first."
        echo ""
        return 1
    fi
    
    cd "$INSTALL_DIR"
    
    # Fetch latest changes from remote
    echo "📡 Fetching latest changes from GitHub..."
    if ! git fetch origin main 2>/dev/null; then
        echo "❌ Failed to fetch updates. Please check your internet connection."
        echo ""
        return 1
    fi
    
    # Check if updates are available
    local local_commit=$(git rev-parse HEAD)
    local remote_commit=$(git rev-parse origin/main)
    
    if [ "$local_commit" = "$remote_commit" ]; then
        echo "✅ You already have the latest version!"
        echo ""
        return 0
    else
        echo "🆕 Updates available!"
        echo ""
        echo "Local version:  $(echo $local_commit | cut -c1-8)"
        echo "Latest version: $(echo $remote_commit | cut -c1-8)"
        echo ""
        
        read -p "Do you want to update now? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "⬇️  Updating to latest version..."
            git reset --hard origin/main
            
            echo "📦 Updating dependencies..."
            npm install
            
            echo ""
            echo "🎉 Update completed successfully!"
            echo ""
            return 0
        else
            echo "Update cancelled."
            echo ""
            return 1
        fi
    fi
}

# Function to open existing dashboard
open_existing_dashboard() {
    echo "🚀 Opening existing dashboard..."
    echo ""
    
    if ! check_existing_installation; then
        echo "❌ No existing installation found."
        echo "Please choose option 2 to install the dashboard first."
        echo ""
        return 1
    fi
    
    cd "$INSTALL_DIR"
    echo "✅ Starting Chatbot Dashboard..."
    echo ""
    echo "🌐 The dashboard will open in your browser shortly."
    echo "If it doesn't open automatically, visit: http://localhost:3000"
    echo ""
    echo "💡 To stop the application, press Ctrl+C"
    echo ""
    
    npm run dev
}

# Function to install the dashboard (fresh installation)
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

# Function to show main menu
show_menu() {
    echo "Please choose an option:"
    echo ""
    echo "1) 🚀 Just Open Dashboard (if already installed)"
    echo "2) 🔄 Check for Updates & Install/Update"
    echo "3) ❌ Exit"
    echo ""
    read -p "Enter your choice (1-3): " -n 1 -r
    echo
    echo ""
    
    case $REPLY in
        1)
            open_existing_dashboard
            ;;
        2)
            if check_existing_installation; then
                check_for_updates
                if [ $? -eq 0 ]; then
                    open_existing_dashboard
                fi
            else
                echo "No existing installation found. Starting fresh installation..."
                echo ""
                missing=$(check_prereqs)
                if [ -n "$missing" ]; then
                    show_install_instructions "$missing"
                else
                    install_dashboard
                fi
            fi
            ;;
        3)
            echo "👋 Goodbye!"
            echo ""
            exit 0
            ;;
        *)
            echo "❌ Invalid choice. Please try again."
            echo ""
            show_menu
            ;;
    esac
}

# Main execution
main() {
    # Show status information
    if check_existing_installation; then
        echo "✅ Existing installation found at: $INSTALL_DIR"
        echo ""
    else
        echo "ℹ️  No existing installation found."
        echo ""
    fi
    
    # Show the menu
    show_menu
    
    echo "Press any key to exit..."
    read -n 1 -s
}

# Run the installer
main

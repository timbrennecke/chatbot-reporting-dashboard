#!/bin/bash

# Chatbot Dashboard Launcher (.command file)
# This file can be double-clicked on Mac without security warnings

# Configuration
INSTALL_DIR="${HOME}/Desktop/chatbot-reporting-dashboard"
DASHBOARD_URL="http://localhost:3000"
DASHBOARD_PORT="3000"

# Clear the screen for a clean start
clear

echo ""
echo "🚀 Chatbot Dashboard Launcher"
echo "=============================="
echo ""

# Function to check if dashboard is installed
check_installation() {
    if [ ! -d "$INSTALL_DIR" ]; then
        return 1
    fi
    
    if [ ! -f "$INSTALL_DIR/package.json" ]; then
        return 1
    fi
    
    return 0
}

# Function to check if dashboard is already running
check_if_running() {
    # Check if port 3000 is in use
    if lsof -Pi :$DASHBOARD_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Function to check if dashboard is accessible
check_if_accessible() {
    # Try to reach the dashboard URL
    if curl -s --connect-timeout 3 "$DASHBOARD_URL" >/dev/null 2>&1; then
        return 0
    fi
    return 1
}

# Function to open browser to dashboard
open_dashboard() {
    echo "🌐 Opening Chatbot Dashboard in browser..."
    
    # Open the dashboard URL in default browser
    open "$DASHBOARD_URL"
    
    echo "✅ Dashboard opened! Check your browser."
    echo ""
}

# Function to start the dashboard
start_dashboard() {
    echo "🚀 Starting Chatbot Dashboard..."
    echo ""
    echo "📝 Note: This will keep running in Terminal."
    echo "   To stop the dashboard later, press Ctrl+C"
    echo ""
    
    # Change to dashboard directory
    cd "$INSTALL_DIR" || {
        echo "❌ Error: Could not access dashboard directory"
        echo "   Expected location: $INSTALL_DIR"
        exit 1
    }
    
    # Start the dashboard
    echo "⏳ Starting up... (this may take a moment)"
    echo ""
    
    # Start and automatically open browser when ready
    npm run dev &
    NPM_PID=$!
    
    # Wait for the dashboard to be accessible
    echo "⏳ Waiting for dashboard to start..."
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if check_if_accessible; then
            echo "✅ Dashboard is ready!"
            sleep 1
            open_dashboard
            wait $NPM_PID
            return 0
        fi
        
        sleep 1
        ((attempt++))
        
        # Show progress dots
        if [ $((attempt % 5)) -eq 0 ]; then
            echo "   Still starting... (${attempt}s elapsed)"
        fi
    done
    
    # If we get here, the dashboard didn't start in time
    echo "⚠️  Dashboard is taking longer than expected to start."
    echo "   It may still be starting up. Check http://localhost:3000 manually."
    echo ""
    wait $NPM_PID
}

# Function to handle installation not found
handle_not_installed() {
    echo "❌ Dashboard Not Found"
    echo "======================"
    echo ""
    echo "The Chatbot Dashboard is not installed at:"
    echo "  $INSTALL_DIR"
    echo ""
    echo "📋 To install the dashboard, run one of these commands:"
    echo ""
    echo "🍺 Easy installation:"
    echo "  curl -fsSL https://raw.githubusercontent.com/timbrennecke/chatbot-reporting-dashboard/main/easy-install.sh | bash"
    echo ""
    echo "📱 Or download and run the installer from:"
    echo "  https://github.com/timbrennecke/chatbot-reporting-dashboard"
    echo ""
    echo "After installation, run this launcher again."
    echo ""
}

# Main function
main() {
    # Check if dashboard is installed
    if ! check_installation; then
        handle_not_installed
        echo "Press any key to exit..."
        read -n 1 -s
        exit 0
    fi
    
    echo "📦 Dashboard installation found!"
    echo ""
    
    # Check if dashboard is already running and accessible
    if check_if_running && check_if_accessible; then
        echo "✅ Dashboard is already running!"
        echo ""
        open_dashboard
        echo "Press any key to exit..."
        read -n 1 -s
        exit 0
    fi
    
    # Check if something is running on port 3000 but not accessible
    if check_if_running; then
        echo "⚠️  Port 3000 is in use but dashboard is not accessible."
        echo "   This might be another application or a stuck process."
        echo ""
        echo "Continue anyway? (y/N): "
        read -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
        echo ""
    fi
    
    # Dashboard is installed but not running, so start it
    start_dashboard
}

# Run the launcher
main


#!/bin/bash

# Chatbot Reporting Dashboard - Auto Deploy Script
# This script automatically fetches the latest version from GitHub and sets up the application locally

set -e  # Exit on any error

# Make this script executable if it isn't already
if [ ! -x "$0" ]; then
    chmod +x "$0"
fi

# Configuration
REPO_URL="https://github.com/timbrennecke/chatbot-reporting-dashboard.git"
APP_NAME="chatbot-reporting-dashboard"
INSTALL_DIR="${HOME}/Desktop/${APP_NAME}"
NODE_MIN_VERSION="18"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check Node.js version
check_node_version() {
    if command_exists node; then
        local node_version=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
        if [ "$node_version" -ge "$NODE_MIN_VERSION" ]; then
            return 0
        else
            return 1
        fi
    else
        return 1
    fi
}

# Function to install Node.js (basic guidance)
install_node() {
    print_error "Node.js v${NODE_MIN_VERSION}+ is required but not found."
    echo ""
    echo "Please install Node.js from one of these sources:"
    echo "1. Official website: https://nodejs.org/"
    echo "2. Using nvm (recommended): https://github.com/nvm-sh/nvm"
    echo "   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
    echo "   nvm install ${NODE_MIN_VERSION}"
    echo "3. Using Homebrew (macOS): brew install node"
    echo ""
    exit 1
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Git
    if ! command_exists git; then
        print_error "Git is required but not installed. Please install Git first."
        exit 1
    fi
    
    # Check Node.js
    if ! check_node_version; then
        install_node
    fi
    
    # Check npm
    if ! command_exists npm; then
        print_error "npm is required but not found. Please install Node.js with npm."
        exit 1
    fi
    
    print_success "All prerequisites are met!"
}

# Function to cleanup existing installation
cleanup_existing() {
    if [ -d "$INSTALL_DIR" ]; then
        print_warning "Existing installation found at $INSTALL_DIR"
        read -p "Do you want to remove it and install fresh? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            print_status "Removing existing installation..."
            rm -rf "$INSTALL_DIR"
            print_success "Existing installation removed."
        else
            print_status "Updating existing installation..."
            cd "$INSTALL_DIR"
            git fetch origin
            git reset --hard origin/main
            return 0
        fi
    fi
    return 1
}

# Function to clone repository
clone_repository() {
    print_status "Cloning repository from GitHub..."
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone "$REPO_URL" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    print_success "Repository cloned successfully!"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed successfully!"
}

# Function to start the application
start_application() {
    print_status "Starting the application..."
    echo ""
    print_success "🎉 Chatbot Reporting Dashboard is ready!"
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "• The application will start automatically in your browser"
    echo "• If it doesn't open, visit: http://localhost:3000"
    echo "• To stop the application, press Ctrl+C"
    echo ""
    echo -e "${YELLOW}To run the application again later:${NC}"
    echo "cd $INSTALL_DIR && npm run dev"
    echo ""
    
    # Start the development server
    npm run dev
}

# Main execution
main() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║        Chatbot Reporting Dashboard          ║${NC}"
    echo -e "${BLUE}║           Auto Deploy Script                ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
    echo ""
    
    check_prerequisites
    
    # Check if we're updating existing installation
    if ! cleanup_existing; then
        clone_repository
    fi
    
    install_dependencies
    start_application
}

# Handle script interruption
trap 'echo -e "\n${YELLOW}Deployment interrupted.${NC}"; exit 1' INT

# Run main function
main "$@"

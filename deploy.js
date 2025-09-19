#!/usr/bin/env node

/**
 * Chatbot Reporting Dashboard - Cross-Platform Auto Deploy Script
 * This script automatically fetches the latest version from GitHub and sets up the application locally
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const REPO_URL = 'https://github.com/timbrennecke/chatbot-reporting-dashboard.git';
const APP_NAME = 'chatbot-reporting-dashboard';
const INSTALL_DIR = path.join(os.homedir(), 'Desktop', APP_NAME);
const NODE_MIN_VERSION = 18;

// Colors for console output
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Utility functions for colored output
const print = {
    status: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
    success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
    warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
    error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`)
};

// Function to check if a command exists
function commandExists(command) {
    try {
        execSync(`${command} --version`, { stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

// Function to get Node.js version
function getNodeVersion() {
    try {
        const version = execSync('node --version', { encoding: 'utf8' });
        return parseInt(version.replace('v', '').split('.')[0]);
    } catch {
        return 0;
    }
}

// Function to check prerequisites
function checkPrerequisites() {
    print.status('Checking prerequisites...');
    
    // Check Git
    if (!commandExists('git')) {
        print.error('Git is required but not installed.');
        console.log('\nPlease install Git from: https://git-scm.com/downloads');
        process.exit(1);
    }
    
    // Check Node.js version
    const nodeVersion = getNodeVersion();
    if (nodeVersion < NODE_MIN_VERSION) {
        print.error(`Node.js v${NODE_MIN_VERSION}+ is required. Current version: v${nodeVersion || 'not found'}`);
        console.log('\nPlease install Node.js from:');
        console.log('1. Official website: https://nodejs.org/');
        console.log('2. Using nvm: https://github.com/nvm-sh/nvm');
        if (os.platform() === 'win32') {
            console.log('3. Using Chocolatey: choco install nodejs');
        } else if (os.platform() === 'darwin') {
            console.log('3. Using Homebrew: brew install node');
        }
        process.exit(1);
    }
    
    // Check npm
    if (!commandExists('npm')) {
        print.error('npm is required but not found. Please install Node.js with npm.');
        process.exit(1);
    }
    
    print.success('All prerequisites are met!');
}

// Function to prompt user input (simple implementation)
function askQuestion(question) {
    return new Promise((resolve) => {
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        readline.question(question, (answer) => {
            readline.close();
            resolve(answer.toLowerCase().trim());
        });
    });
}

// Function to execute command with real-time output
function executeCommand(command, cwd = process.cwd()) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, { shell: true, cwd, stdio: 'inherit' });
        
        child.on('close', (code) => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`Command failed with exit code ${code}`));
            }
        });
        
        child.on('error', reject);
    });
}

// Function to cleanup existing installation
async function cleanupExisting() {
    if (fs.existsSync(INSTALL_DIR)) {
        print.warning(`Existing installation found at ${INSTALL_DIR}`);
        const answer = await askQuestion('Do you want to remove it and install fresh? (y/N): ');
        
        if (answer === 'y' || answer === 'yes') {
            print.status('Removing existing installation...');
            fs.rmSync(INSTALL_DIR, { recursive: true, force: true });
            print.success('Existing installation removed.');
            return false;
        } else {
            print.status('Updating existing installation...');
            try {
                await executeCommand('git fetch origin', INSTALL_DIR);
                await executeCommand('git reset --hard origin/main', INSTALL_DIR);
                return true;
            } catch (error) {
                print.error('Failed to update existing installation. Will do fresh install.');
                fs.rmSync(INSTALL_DIR, { recursive: true, force: true });
                return false;
            }
        }
    }
    return false;
}

// Function to clone repository
async function cloneRepository() {
    print.status('Cloning repository from GitHub...');
    
    // Create parent directory if it doesn't exist
    const parentDir = path.dirname(INSTALL_DIR);
    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
    }
    
    await executeCommand(`git clone ${REPO_URL} "${INSTALL_DIR}"`);
    print.success('Repository cloned successfully!');
}

// Function to install dependencies
async function installDependencies() {
    print.status('Installing dependencies...');
    await executeCommand('npm install', INSTALL_DIR);
    print.success('Dependencies installed successfully!');
}

// Function to start the application
async function startApplication() {
    print.status('Starting the application...');
    console.log('');
    print.success('🎉 Chatbot Reporting Dashboard is ready!');
    console.log('');
    console.log(`${colors.blue}Next steps:${colors.reset}`);
    console.log('• The application will start automatically in your browser');
    console.log('• If it doesn\'t open, visit: http://localhost:3000');
    console.log('• To stop the application, press Ctrl+C');
    console.log('');
    console.log(`${colors.yellow}To run the application again later:${colors.reset}`);
    if (os.platform() === 'win32') {
        console.log(`cd "${INSTALL_DIR}" && npm run dev`);
    } else {
        console.log(`cd "${INSTALL_DIR}" && npm run dev`);
    }
    console.log('');
    
    // Start the development server
    await executeCommand('npm run dev', INSTALL_DIR);
}

// Main execution function
async function main() {
    console.log('');
    console.log(`${colors.blue}╔══════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.blue}║        Chatbot Reporting Dashboard          ║${colors.reset}`);
    console.log(`${colors.blue}║           Auto Deploy Script                ║${colors.reset}`);
    console.log(`${colors.blue}╚══════════════════════════════════════════════╝${colors.reset}`);
    console.log('');
    
    try {
        checkPrerequisites();
        
        // Check if we're updating existing installation
        const isUpdate = await cleanupExisting();
        
        if (!isUpdate) {
            await cloneRepository();
        }
        
        await installDependencies();
        await startApplication();
        
    } catch (error) {
        print.error(`Deployment failed: ${error.message}`);
        process.exit(1);
    }
}

// Handle script interruption
process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}Deployment interrupted.${colors.reset}`);
    process.exit(1);
});

// Run main function if this script is executed directly
if (require.main === module) {
    main();
}

module.exports = { main };

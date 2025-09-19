
# Chatbot Reporting Dashboard

This is a modern React-based dashboard for chatbot reporting and analytics. The original design is available at https://www.figma.com/design/lxuOCZECsyIvHhUEh6Ut9e/Chatbot-Reporting-Dashboard.

## 🚀 Quick Deploy (Recommended)

The easiest way to get the application running on any computer is to use our auto-deploy scripts. These scripts will automatically:
- Check prerequisites (Node.js, Git, npm)
- Download the latest version from GitHub
- Install dependencies
- Start the application

### For macOS (Double-Click Option):
**Option 1: Double-Click App Bundle** 
1. Download the `Chatbot Dashboard Installer.app` from the repository
2. Double-click the app to install and run

**Option 2: Terminal One-Liner**
```bash
# Easy install with automatic permissions
curl -fsSL https://raw.githubusercontent.com/timbrennecke/chatbot-reporting-dashboard/main/easy-install.sh | bash
```

### For Linux/Unix:
```bash
# Download and run with proper permissions
curl -fsSL https://raw.githubusercontent.com/timbrennecke/chatbot-reporting-dashboard/main/deploy.sh -o installer.sh && chmod +x installer.sh && ./installer.sh
```

### For Windows:
```cmd
# Download and run the deploy script
curl -fsSL https://raw.githubusercontent.com/timbrennecke/chatbot-reporting-dashboard/main/deploy.bat -o deploy.bat && deploy.bat
```

Or download the script manually and double-click `deploy.bat`

### Cross-Platform (Node.js):
If you have Node.js installed, you can use the cross-platform script:
```bash
# Download and run the Node.js deploy script
curl -fsSL https://raw.githubusercontent.com/timbrennecke/chatbot-reporting-dashboard/main/deploy.js | node
```

## 📋 Prerequisites

Before using the auto-deploy scripts, ensure you have:
- **Git** - [Download Git](https://git-scm.com/downloads)
- **Node.js v18+** - [Download Node.js](https://nodejs.org/)
- **npm** (comes with Node.js)

## 🛠️ Manual Installation

If you prefer to install manually:

### 1. Clone the repository
```bash
git clone https://github.com/timbrennecke/chatbot-reporting-dashboard.git
cd chatbot-reporting-dashboard
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the development server
```bash
npm run dev
```

The application will open automatically in your browser at `http://localhost:3000`.

## 📦 Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the application for production
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run ESLint to check code quality

## 🔧 Configuration

The application includes proxy configuration for API endpoints:
- `/api` - Production API (api.bot.check24.de)
- `/api-test` - Test API (api.bot.check24-test.de)

## 🌟 Features

- **Interactive Dashboard** - View chatbot analytics and metrics
- **Conversation Details** - Dive deep into individual conversations
- **Thread Overview** - Manage and analyze conversation threads
- **JSON Upload** - Import conversation data
- **Responsive Design** - Works on desktop and mobile devices
- **Modern UI** - Built with React and modern design principles

## 💻 System Requirements

- **Operating System**: Windows 10+, macOS 10.15+, or Linux
- **Node.js**: Version 18 or higher
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB free space
- **Browser**: Chrome, Firefox, Safari, or Edge (latest versions)

## 🔄 Updates

To update to the latest version:
1. Run any of the deploy scripts again, or
2. Navigate to your installation directory and run:
   ```bash
   git pull origin main
   npm install
   npm run dev
   ```

## 🐛 Troubleshooting

### Common Issues:

**Port 3000 is already in use:**
- Stop any other applications using port 3000
- Or modify the port in `vite.config.ts`

**npm install fails:**
- Delete `node_modules` and `package-lock.json`
- Run `npm install` again

**Git clone fails:**
- Check your internet connection
- Ensure Git is properly installed

### Getting Help:
- Check the [Issues](https://github.com/timbrennecke/chatbot-reporting-dashboard/issues) page
- Create a new issue with detailed error information

## 📄 License

This project is private and confidential.
  
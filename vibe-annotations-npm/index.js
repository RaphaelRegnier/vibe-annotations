#!/usr/bin/env node

const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const GITHUB_REPO = 'git+https://github.com/RaphaelRegnier/vibe-annotations-server.git';
const COMMAND_NAME = 'vibe-annotations-server';

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = '') {
  console.log(`${color}${message}${colors.reset}`);
}

function checkIfInstalled() {
  try {
    execSync(`which ${COMMAND_NAME}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function getInstalledVersion() {
  try {
    const output = execSync(`${COMMAND_NAME} --version`, { encoding: 'utf8' });
    return output.trim();
  } catch {
    return null;
  }
}

function installFromGitHub() {
  log('📦 Installing vibe-annotations-server from GitHub...', colors.cyan);
  try {
    execSync(`npm install -g ${GITHUB_REPO}`, { stdio: 'inherit' });
    log('✅ Successfully installed vibe-annotations-server!', colors.green);
    return true;
  } catch (error) {
    log('❌ Failed to install. Please try manually:', colors.yellow);
    log(`   npm install -g ${GITHUB_REPO}`, colors.dim);
    return false;
  }
}

function uninstallServer() {
  log('🗑️  Uninstalling vibe-annotations-server...', colors.cyan);
  
  // First try to stop the server if it's running
  try {
    log('   Stopping server first...', colors.dim);
    execSync(`${COMMAND_NAME} stop`, { stdio: 'ignore', timeout: 5000 });
  } catch {
    // Server might not be running or stop command failed, continue
    log('   (Server stop completed or not running)', colors.dim);
  }
  
  // Check if server is currently installed
  if (!checkIfInstalled()) {
    log('ℹ️  vibe-annotations-server is not globally installed', colors.yellow);
    return true;
  }
  
  // Attempt to uninstall
  try {
    execSync('npm uninstall -g vibe-annotations-server', { stdio: 'inherit' });
    
    // Verify uninstallation worked
    if (!checkIfInstalled()) {
      log('✅ Successfully uninstalled vibe-annotations-server!', colors.green);
      log('   Server command is no longer available', colors.dim);
      return true;
    } else {
      log('⚠️  Uninstall command ran, but server still appears to be installed', colors.yellow);
      return false;
    }
  } catch (error) {
    log('❌ Failed to uninstall. Please try manually:', colors.yellow);
    log('   npm uninstall -g vibe-annotations-server', colors.dim);
    return false;
  }
}

function runCommand(args) {
  const child = spawn(COMMAND_NAME, args, { stdio: 'inherit' });
  
  child.on('error', (error) => {
    if (error.code === 'ENOENT') {
      log('❌ Command not found. Installation may have failed.', colors.yellow);
    } else {
      log(`❌ Error: ${error.message}`, colors.yellow);
    }
  });

  child.on('exit', (code) => {
    process.exit(code);
  });
}

function main() {
  const args = process.argv.slice(2);
  
  // Show version for this wrapper
  if (args.includes('--wrapper-version')) {
    const packageJson = require('./package.json');
    log(`npm wrapper version: ${packageJson.version}`, colors.dim);
    return;
  }

  // Handle uninstall command
  if (args[0] === 'uninstall') {
    log('🌟 Vibe Annotations Server - Uninstall', colors.bright);
    const success = uninstallServer();
    process.exit(success ? 0 : 1);
  }

  log('🌟 Vibe Annotations Server', colors.bright);
  
  // Check if vibe-annotations-server is installed
  if (!checkIfInstalled()) {
    log('📋 First time setup detected...', colors.blue);
    
    // Install from GitHub
    if (!installFromGitHub()) {
      process.exit(1);
    }
  } else {
    // Show installed version
    const version = getInstalledVersion();
    if (version) {
      log(`   Version: ${version}`, colors.dim);
    }
  }

  // If no arguments provided, default to 'start'
  const finalArgs = args.length === 0 ? ['start'] : args;
  
  // Run the actual command
  log('🚀 Starting server...', colors.cyan);
  runCommand(finalArgs);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n👋 Shutting down...', colors.yellow);
  process.exit(0);
});

main();
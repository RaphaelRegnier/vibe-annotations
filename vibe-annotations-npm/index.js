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

  // Run the actual command
  log('🚀 Starting server...', colors.cyan);
  runCommand(args);
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  log('\n👋 Shutting down...', colors.yellow);
  process.exit(0);
});

main();
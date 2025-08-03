#!/usr/bin/env node

import { Command } from 'commander';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, openSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { homedir } from 'os';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);
const program = new Command();

// Configuration paths
const CONFIG_DIR = join(homedir(), '.vibe-annotations');
const PID_FILE = join(CONFIG_DIR, 'server.pid');
const LOG_FILE = join(CONFIG_DIR, 'server.log');
const PORT = 3846;

// Ensure config directory exists
if (!existsSync(CONFIG_DIR)) {
  mkdirSync(CONFIG_DIR, { recursive: true });
}

// Helper functions
function isServerRunning() {
  if (!existsSync(PID_FILE)) {
    return false;
  }
  
  try {
    const pid = readFileSync(PID_FILE, 'utf8').trim();
    process.kill(parseInt(pid), 0); // Check if process exists
    return true;
  } catch (e) {
    // Process doesn't exist
    if (existsSync(PID_FILE)) {
      // Clean up stale PID file
      unlinkSync(PID_FILE);
    }
    return false;
  }
}

async function checkPort() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/health`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

// Commands
program
  .name('vibe-annotations-server')
  .description('Global MCP server for Vibe Annotations browser extension')
  .version('0.1.2');

program
  .command('start')
  .description('Start the Vibe Annotations server')
  .option('-d, --daemon', 'Run as daemon (background process)')
  .action(async (options) => {
    if (isServerRunning()) {
      console.log(chalk.yellow('✓ Server is already running'));
      console.log(chalk.gray(`  Port: ${PORT}`));
      console.log(chalk.gray(`  PID: ${readFileSync(PID_FILE, 'utf8').trim()}`));
      return;
    }

    console.log(chalk.blue('Starting Vibe Annotations server...'));

    const serverPath = join(dirname(__dirname), 'lib', 'server.js');
    
    if (options.daemon) {
      // Run as daemon
      const out = fs.openSync(LOG_FILE, 'a');
      const err = fs.openSync(LOG_FILE, 'a');
      
      const child = spawn('node', [serverPath], {
        detached: true,
        stdio: ['ignore', out, err],
        env: { ...process.env, NODE_ENV: 'production' }
      });
      
      child.unref();
      writeFileSync(PID_FILE, child.pid.toString());
      
      // Wait for server to start
      let attempts = 0;
      while (attempts < 10) {
        if (await checkPort()) {
          console.log(chalk.green('✅ Vibe Annotations server running on http://127.0.0.1:3846/sse'));
          console.log(chalk.gray(`   PID: ${child.pid}`));
          console.log(chalk.gray(`   Logs: ${LOG_FILE}`));
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
      }
      
      if (attempts >= 10) {
        console.log(chalk.red('❌ Failed to start server. Check logs at:'));
        console.log(chalk.gray(`   ${LOG_FILE}`));
      }
    } else {
      // Run in foreground
      const child = spawn('node', [serverPath], {
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' }
      });
      
      writeFileSync(PID_FILE, child.pid.toString());
      
      child.on('exit', () => {
        if (existsSync(PID_FILE)) {
          unlinkSync(PID_FILE);
        }
      });
    }
  });

program
  .command('stop')
  .description('Stop the Vibe Annotations server')
  .action(() => {
    if (!isServerRunning()) {
      console.log(chalk.yellow('Server is not running'));
      return;
    }
    
    try {
      const pid = readFileSync(PID_FILE, 'utf8').trim();
      process.kill(parseInt(pid), 'SIGTERM');
      
      if (existsSync(PID_FILE)) {
        unlinkSync(PID_FILE);
      }
      
      console.log(chalk.green('✅ Server stopped'));
    } catch (error) {
      console.log(chalk.red('❌ Failed to stop server:'), error.message);
    }
  });

program
  .command('restart')
  .description('Restart the Vibe Annotations server')
  .action(async () => {
    console.log(chalk.blue('Restarting server...'));
    
    // Stop if running
    if (isServerRunning()) {
      try {
        const pid = readFileSync(PID_FILE, 'utf8').trim();
        process.kill(parseInt(pid), 'SIGTERM');
        
        if (existsSync(PID_FILE)) {
          unlinkSync(PID_FILE);
        }
        
        // Wait for process to stop
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.log(chalk.yellow('Warning:'), error.message);
      }
    }
    
    // Start with daemon flag
    program.parse(['node', 'cli.js', 'start', '--daemon'], { from: 'user' });
  });

program
  .command('status')
  .description('Check server status')
  .action(async () => {
    const running = isServerRunning();
    const portAvailable = await checkPort();
    
    if (running && portAvailable) {
      console.log(chalk.green('✅ Server is running'));
      console.log(chalk.gray(`   PID: ${readFileSync(PID_FILE, 'utf8').trim()}`));
      console.log(chalk.gray(`   Port: ${PORT}`));
      console.log(chalk.gray(`   URL: http://127.0.0.1:${PORT}/sse`));
    } else if (running && !portAvailable) {
      console.log(chalk.yellow('⚠️  Server process exists but is not responding'));
      console.log(chalk.gray('   Try running: vibe-annotations-server restart'));
    } else {
      console.log(chalk.gray('○ Server is not running'));
    }
  });

program
  .command('logs')
  .description('View server logs')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action((options) => {
    if (!existsSync(LOG_FILE)) {
      console.log(chalk.gray('No logs available yet'));
      return;
    }
    
    if (options.follow) {
      // Use tail -f
      const tail = spawn('tail', ['-f', LOG_FILE], { stdio: 'inherit' });
      
      process.on('SIGINT', () => {
        tail.kill();
        process.exit();
      });
    } else {
      // Show last N lines
      const tail = spawn('tail', ['-n', options.lines, LOG_FILE], { stdio: 'inherit' });
    }
  });

program.parse(process.argv);
#!/usr/bin/env node

import { Command } from 'commander';
import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, openSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { homedir } from 'os';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read version from package.json automatically
const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

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
  .version(packageJson.version);

program
  .command('init')
  .description('Interactive setup wizard: install server, configure MCP, link the extension')
  .option('--agent <name>', 'Configure specific agent (repeatable). One of: claude-code, cursor, windsurf, codex, openclaw, opencode, vscode', collectAgent, [])
  .option('--non-interactive', 'No prompts; use defaults. Auto-applied on CI or no TTY.')
  .option('--skip-extension', 'Skip the Chrome extension prompt')
  .option('--skip-server', 'Skip installing/starting the server')
  .option('--skip-claude-mod', 'Skip installing the Claude Code mod')
  .option('--project', 'Configure MCP at project scope instead of user scope')
  .option('--reset', 'Remove existing vibe-annotations entries from known agent configs before configuring')
  .action(async (options) => {
    const { runInit } = await import('../lib/init/index.js');
    await runInit({
      agent: options.agent.length ? options.agent : null,
      nonInteractive: !!options.nonInteractive,
      skipExtension: !!options.skipExtension,
      skipServer: !!options.skipServer,
      skipClaudeMod: !!options.skipClaudeMod,
      project: !!options.project,
      reset: !!options.reset,
    });
  });

function collectAgent(value, previous) {
  return previous.concat(value);
}

// Starts the server in the background (detached, logging to LOG_FILE) and
// waits until it answers. Uses the node running this CLI, not whichever one
// PATH finds first (apps launched from the Dock don't get the shell's PATH).
async function startDaemon() {
  const serverPath = join(dirname(__dirname), 'lib', 'server.js');
  const out = fs.openSync(LOG_FILE, 'a');
  const err = fs.openSync(LOG_FILE, 'a');
  const child = spawn(process.execPath, [serverPath], {
    detached: true,
    stdio: ['ignore', out, err],
    env: { ...process.env, NODE_ENV: 'production' }
  });
  child.unref();
  writeFileSync(PID_FILE, child.pid.toString());

  for (let attempts = 0; attempts < 10; attempts++) {
    if (await checkPort()) {
      console.log(chalk.green('✅ Vibe Annotations server running on http://127.0.0.1:3846/sse'));
      console.log(chalk.gray(`   PID: ${child.pid}`));
      console.log(chalk.gray(`   Logs: ${LOG_FILE}`));
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  console.log(chalk.red('❌ Failed to start server. Check logs at:'));
  console.log(chalk.gray(`   ${LOG_FILE}`));
  return false;
}

// Stops the server started from the pid file, then waits until the port stops
// answering: the server shuts down gracefully, and a start in the meantime
// would mistake the old one for the new.
async function stopServer() {
  if (!isServerRunning()) return false;
  const pid = readFileSync(PID_FILE, 'utf8').trim();
  process.kill(parseInt(pid), 'SIGTERM');
  if (existsSync(PID_FILE)) unlinkSync(PID_FILE);
  for (let i = 0; i < 20 && await checkPort(); i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return true;
}

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

    if (options.daemon) {
      await startDaemon();
    } else {
      // Run in foreground
      const serverPath = join(dirname(__dirname), 'lib', 'server.js');
      const child = spawn(process.execPath, [serverPath], {
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
  .action(async () => {
    try {
      if (await stopServer()) console.log(chalk.green('✅ Server stopped'));
      else console.log(chalk.yellow('Server is not running'));
    } catch (error) {
      console.log(chalk.red('❌ Failed to stop server:'), error.message);
    }
  });

program
  .command('restart')
  .description('Restart the Vibe Annotations server')
  .action(async () => {
    console.log(chalk.blue('Restarting server...'));
    try {
      await stopServer();
    } catch (error) {
      console.log(chalk.yellow('Warning:'), error.message);
    }
    if (await checkPort()) {
      console.log(chalk.red(`❌ Something else still answers on port ${PORT} (a server started by hand?). Stop it, then run start.`));
      process.exitCode = 1;
      return;
    }
    await startDaemon();
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
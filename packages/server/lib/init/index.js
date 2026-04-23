import * as p from '@clack/prompts';
import chalk from 'chalk';
import { checkEnvironment } from './environment.js';
import { installServer, startServer } from './server.js';
import { AGENTS, findAgent, detectAll, applyAgent, removeAgent } from './agents/index.js';
import { runExtensionStep, CWS_URL } from './extension.js';

const MCP_URL = 'http://127.0.0.1:3846/mcp';

export async function runInit(options = {}) {
  const interactive = resolveInteractive(options);
  const scope = options.project ? 'project' : 'user';
  const cwd = process.cwd();

  console.log();
  p.intro(chalk.bgCyan.black(' Vibe Annotations — Setup Wizard '));

  const env = await withSpinner('Checking environment', 'Environment checked', () => checkEnvironment());
  renderEnvironment(env);

  if (!env.nodeOk) {
    p.cancel(`Node.js ${env.node} is too old — requires v16+.`);
    process.exit(1);
  }

  if (env.portState.state === 'foreign') {
    p.cancel(foreignPortMessage());
    process.exit(1);
  }

  if (options.reset) {
    await runReset({ cwd, scope, interactive });
  }

  const serverOutcome = options.skipServer
    ? { status: 'skipped' }
    : await runServerStep({ env, interactive });

  const agentResults = await runAgentStep({
    interactive,
    scope,
    cwd,
    preselected: normalizeAgentOption(options.agent),
  });

  const extensionResult = options.skipExtension
    ? { status: 'link-only' }
    : await runExtensionStep({ interactive });

  renderSummary({ serverOutcome, agentResults, extensionResult, scope });
}

function resolveInteractive(options) {
  if (options.nonInteractive) return false;
  if (process.env.CI) return false;
  if (!process.stdin.isTTY) return false;
  return true;
}

function normalizeAgentOption(opt) {
  if (!opt) return null;
  if (Array.isArray(opt)) return opt;
  return [opt];
}

async function runServerStep({ env, interactive }) {
  p.log.step('Step 1/3 — Annotation server');

  if (env.serverInstalled.installed && env.portState.state === 'ours') {
    p.log.success(`vibe-annotations-server@${env.serverInstalled.version} already running on http://127.0.0.1:3846`);
    return { status: 'already-running', version: env.portState.version };
  }

  if (!env.serverInstalled.installed) {
    const result = await withSpinner(
      `Installing vibe-annotations-server (${env.pkgMgr || 'npm'})`,
      'Server installed',
      () => installServer(env.pkgMgr),
    );
    if (!result.ok) {
      if (result.permDenied) {
        p.log.error(
          'Install failed: permission denied on global install.\n' +
          '  Try running with sudo, or fix your npm prefix:\n' +
          '  https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally',
        );
      } else {
        p.log.error(`Install failed:\n${result.stderr?.trim() || '(no stderr)'}`);
      }
      return { status: 'install-failed' };
    }
  }

  if (env.portState.state === 'ours') {
    p.log.success('Server already running');
    return { status: 'already-running' };
  }

  const start = await withSpinner('Starting server', 'Server running', () => startServer());
  if (!start.ok) {
    p.log.error(`Failed to start server (${start.reason}). Logs: ${start.logFile || 'n/a'}`);
    return { status: 'start-failed' };
  }
  return { status: 'started', pid: start.pid };
}

async function runAgentStep({ interactive, scope, cwd, preselected }) {
  p.log.step('Step 2/3 — Configuring your coding agent');

  const detected = await detectAll();
  const detectedIds = AGENTS.filter((a) => detected[a.id]).map((a) => a.id);

  let selected;
  if (preselected) {
    selected = preselected.map((id) => findAgent(id)?.id).filter(Boolean);
    if (selected.length === 0) {
      p.log.warn(`No valid agents in --agent (${preselected.join(', ')}). Skipping config step.`);
      return [];
    }
    p.log.info(`Configuring: ${selected.join(', ')}`);
  } else if (!interactive) {
    if (detectedIds.length === 0) {
      p.log.warn('No agents detected and running non-interactively — skipping agent config. Use --agent to force.');
      return [];
    }
    selected = detectedIds;
    p.log.info(`Non-interactive: configuring detected agents (${selected.join(', ')})`);
  } else {
    if (detectedIds.length === 0) {
      p.log.info('No agents detected on this system, but you can still configure any\nof them — the config file will be written now and picked up when\nyou install the agent later.');
    } else {
      p.log.info(`Detected: ${detectedIds.join(', ')}`);
    }

    const picked = await p.multiselect({
      message: 'Which agent(s) do you want to configure?',
      options: AGENTS.map((a) => ({
        value: a.id,
        label: `${a.label}${detected[a.id] ? chalk.dim(' (detected)') : ''}`,
      })),
      initialValues: detectedIds,
      required: false,
    });

    if (p.isCancel(picked)) {
      return [];
    }
    selected = picked;
  }

  if (selected.length === 0) {
    p.log.info('No agents selected. Manual config snippet:\n' +
      '  {\n' +
      `    "mcpServers": {\n` +
      `      "vibe-annotations": { "transport": "http", "url": "${MCP_URL}" }\n` +
      '    }\n' +
      '  }');
    return [];
  }

  const results = [];
  for (const id of selected) {
    const agent = findAgent(id);
    const outcome = await applyAgent(agent, {
      scope,
      cwd,
      detected: detected[id],
      confirmOverwrite: (ctx) => promptOverwrite(ctx, interactive),
    });
    reportAgentOutcome(agent, outcome, { detected: detected[id] });
    results.push({ agent, outcome });
  }
  return results;
}

async function promptOverwrite({ agent, path, current, next }, interactive) {
  if (!interactive) return true;
  p.log.warn(
    `${agent.label}: existing vibe-annotations config found at ${path}\n` +
    `  current: ${formatValue(current)}\n` +
    `  new:     ${formatValue(next)}`,
  );
  const answer = await p.confirm({ message: 'Overwrite?', initialValue: true });
  if (p.isCancel(answer)) return false;
  return answer;
}

function formatValue(v) {
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function reportAgentOutcome(agent, outcome, { detected }) {
  const path = outcome.path ? chalk.dim(outcome.path) : '';
  if (outcome.status === 'ok' && outcome.method === 'cli') {
    p.log.success(`${agent.label}: configured via CLI ${path}`);
  } else if (outcome.status === 'ok' && outcome.method === 'file') {
    const suffix = detected ? '' : chalk.dim(' (agent not detected — config waits until you install it)');
    p.log.success(`${agent.label}: wrote config ${path}${suffix}`);
  } else if (outcome.status === 'noop') {
    p.log.info(`${agent.label}: already configured ${path}`);
  } else if (outcome.status === 'skipped') {
    p.log.warn(`${agent.label}: skipped (existing config kept) ${path}`);
  } else if (outcome.status === 'unreadable') {
    p.log.error(
      `${agent.label}: could not parse existing config at ${outcome.path}.\n` +
      `  Add this entry manually:\n` +
      `    { "mcpServers": { "vibe-annotations": { "transport": "http", "url": "${MCP_URL}" } } }`,
    );
  } else if (outcome.status === 'unsupported-scope') {
    p.log.warn(`${agent.label}: scope not supported for this agent — skipped.`);
  }
}

async function runReset({ cwd, scope, interactive }) {
  if (interactive) {
    const ok = await p.confirm({
      message: `--reset will remove existing vibe-annotations entries from all known agent configs (${scope} scope). Continue?`,
      initialValue: false,
    });
    if (p.isCancel(ok) || !ok) {
      p.cancel('Reset aborted.');
      process.exit(1);
    }
  }
  for (const agent of AGENTS) {
    const result = removeAgent(agent, { scope, cwd });
    if (result.status === 'removed') {
      p.log.info(`Reset: removed ${agent.label} entry at ${result.path}`);
    }
  }
}

function renderEnvironment(env) {
  const lines = [];
  lines.push(`  ${ok(env.nodeOk)} Node.js v${env.node}`);
  lines.push(`  ${ok(!!env.pkgMgr)} Package manager: ${env.pkgMgr ?? 'none detected'}`);

  if (env.serverInstalled.installed) {
    lines.push(`  ${ok(true)} vibe-annotations-server@${env.serverInstalled.version} installed globally`);
  } else {
    lines.push(`  ${chalk.gray('○')} vibe-annotations-server not installed globally`);
  }

  if (env.portState.state === 'free') {
    lines.push(`  ${chalk.gray('○')} Port 3846 free`);
  } else if (env.portState.state === 'foreign') {
    lines.push(`  ${chalk.red('✗')} Port 3846 occupied by another process`);
  } else {
    lines.push(`  ${ok(true)} Server running on http://127.0.0.1:3846 (v${env.portState.version})`);
  }

  p.log.info(lines.join('\n'));
}

function foreignPortMessage() {
  return (
    `Port 3846 is in use by another process.\n` +
    `  Vibe Annotations needs port 3846 (the Chrome extension expects it).\n` +
    `  Free the port and run this wizard again.\n\n` +
    `  To find what's using it:\n` +
    `    macOS/Linux:  lsof -i :3846\n` +
    `    Windows:      netstat -ano | findstr :3846`
  );
}

function renderSummary({ serverOutcome, agentResults, extensionResult, scope }) {
  p.log.step('Step 3/3 — Done');

  const configured = agentResults
    .filter(({ outcome }) => outcome.status === 'ok' || outcome.status === 'noop')
    .map(({ agent }) => agent.label);

  const skipped = agentResults
    .filter(({ outcome }) => outcome.status === 'skipped')
    .map(({ agent }) => agent.label);

  const lines = [];
  lines.push(`Server:    ${serverStatusLine(serverOutcome)}`);
  lines.push(`MCP:       ${configured.length ? `${configured.join(', ')} (${scope} scope)` : 'no agents configured'}`);
  if (skipped.length) lines.push(`Skipped:   ${skipped.join(', ')}`);
  lines.push(`Extension: ${extensionSummary(extensionResult)}`);

  p.log.success(lines.join('\n'));

  const serverRunning = serverOutcome.status === 'started' || serverOutcome.status === 'already-running';
  const serverBlock = serverRunning
    ? '\n\n  The server runs in the background on :3846. Manage it with:\n' +
      '    vibe-annotations-server status    health check\n' +
      '    vibe-annotations-server logs -f   follow output\n' +
      '    vibe-annotations-server stop      stop the daemon'
    : '';

  p.note(
    'Next steps:\n' +
    '  1. Open your localhost dev server in Chrome\n' +
    '  2. Click the Vibe Annotations icon in the toolbar\n' +
    '  3. Start annotating — your agent will pick up feedback via MCP' +
    serverBlock + '\n\n' +
    '  vibe-annotations init --reset     reconfigure from scratch',
    'Next steps',
  );

  p.outro('Setup complete.');
}

function serverStatusLine(outcome) {
  switch (outcome.status) {
    case 'already-running': return 'running in background on http://127.0.0.1:3846';
    case 'started': return `started in background on http://127.0.0.1:3846 (pid ${outcome.pid})`;
    case 'install-failed': return 'install failed';
    case 'start-failed': return 'start failed';
    case 'skipped': return 'skipped (--skip-server)';
    default: return outcome.status;
  }
}

function extensionSummary(result) {
  switch (result.status) {
    case 'confirmed': return 'confirmed installed';
    case 'link-provided': return `link opened (${CWS_URL})`;
    case 'link-only': return `install from ${CWS_URL}`;
    case 'skipped': return `NOT installed — install from ${CWS_URL}`;
    default: return result.status;
  }
}

async function withSpinner(startMsg, endMsg, fn) {
  const s = p.spinner();
  s.start(startMsg);
  try {
    const result = await fn();
    s.stop(endMsg);
    return result;
  } catch (err) {
    s.stop(`${startMsg} — failed`);
    throw err;
  }
}

function ok(pass) {
  return pass ? chalk.green('✓') : chalk.red('✗');
}

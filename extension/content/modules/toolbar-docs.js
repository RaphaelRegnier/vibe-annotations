// Documentation panels and workflow guides for the toolbar settings dropdown.
// Extracted from floating-toolbar.js to keep each module focused.

var VibeToolbarDocs = (() => {

  function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function wireCopyButtons(container, ICONS) {
    container.querySelectorAll('.vibe-guide-copy').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cmd = btn.closest('.vibe-guide-cmd').dataset.cmd;
        await navigator.clipboard.writeText(cmd);
        btn.innerHTML = ICONS.check;
        setTimeout(() => { btn.innerHTML = ICONS.clipboard; }, 1500);
      });
    });
  }

  function wireTabSwitching(container) {
    container.querySelectorAll('.vibe-guide-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        container.querySelectorAll('.vibe-guide-tab').forEach(t => t.classList.remove('active'));
        container.querySelectorAll('.vibe-guide-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        container.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
      });
    });
  }

  function showDocumentation(dropdown, ICONS, callbacks) {
    if (!dropdown) return;
    const header = dropdown.querySelector('.vibe-settings-header');
    const body = dropdown.querySelector('.vibe-settings-body');
    if (!header || !body) return;

    const version = chrome.runtime.getManifest().version;

    header.innerHTML = `
      <button class="vibe-guide-back-btn" type="button" style="display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:var(--v-text-secondary);font-family:var(--v-font);font-size:13px;padding:0;">
        ${ICONS.back}
        <span style="color:var(--v-text-primary);font-weight:600;">Documentation</span>
      </button>
    `;

    body.innerHTML = `
      <button class="vibe-settings-link vibe-get-started-guide-btn" type="button">
        ${ICONS.rocket}
        <span>Get started</span>
        <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
      </button>
      <button class="vibe-settings-link vibe-mcp-server-btn" type="button">
        ${ICONS.server}
        <span>MCP Server</span>
        <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
      </button>
      <div class="vibe-settings-separator"></div>
      <button class="vibe-settings-link vibe-workflow-btn" data-workflow="single-page" type="button">
        ${ICONS.webpage}
        <span>Editing a single page</span>
        <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
      </button>
      <button class="vibe-settings-link vibe-workflow-btn" data-workflow="multi-page" type="button">
        ${ICONS.globe}
        <span>Editing multiple pages</span>
        <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
      </button>
      <button class="vibe-settings-link vibe-workflow-btn" data-workflow="collaborate" type="button">
        ${ICONS.users}
        <span>Collaborating</span>
        <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
      </button>
      <button class="vibe-settings-link vibe-workflow-btn" data-workflow="agents" type="button">
        ${ICONS.robot}
        <span>Annotating with agents</span>
        <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
      </button>
      <button class="vibe-settings-link vibe-workflow-btn" data-workflow="watch-mode" type="button">
        ${ICONS.eye}
        <span>Watch mode</span>
        <span style="margin-left:auto;color:var(--v-text-secondary);">${ICONS.chevronRight}</span>
      </button>
      <div class="vibe-settings-separator"></div>
      <a href="https://github.com/RaphaelRegnier/vibe-annotations" target="_blank" rel="noopener" class="vibe-settings-link">
        ${ICONS.github}
        <span>Contribute to Vibe Annotations</span>
      </a>
      <a href="https://github.com/RaphaelRegnier/vibe-annotations/releases/tag/v${escapeHTML(version)}" target="_blank" rel="noopener" class="vibe-settings-link">
        ${ICONS.newspaper}
        <span>Release notes</span>
      </a>
    `;

    header.querySelector('.vibe-guide-back-btn').addEventListener('click', () => {
      callbacks.onBack();
    });

    body.querySelector('.vibe-get-started-guide-btn').addEventListener('click', () => showGetStartedGuide(dropdown, ICONS, callbacks));
    body.querySelector('.vibe-mcp-server-btn').addEventListener('click', () => showWorkflow(dropdown, 'mcp-setup', ICONS, callbacks));

    body.querySelectorAll('.vibe-workflow-btn').forEach(btn => {
      btn.addEventListener('click', () => showWorkflow(dropdown, btn.dataset.workflow, ICONS, callbacks));
    });
  }

  function showGetStartedGuide(dropdown, ICONS, callbacks) {
    if (!dropdown) return;
    const header = dropdown.querySelector('.vibe-settings-header');
    const body = dropdown.querySelector('.vibe-settings-body');
    if (!header || !body) return;

    header.innerHTML = `
      <button class="vibe-guide-back-btn" type="button" style="display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:var(--v-text-secondary);font-family:var(--v-font);font-size:13px;padding:0;">
        ${ICONS.back}
        <span style="color:var(--v-text-primary);font-weight:600;">Get started</span>
      </button>
    `;

    body.innerHTML = `
      <div class="vibe-guide">
        <div class="vibe-guide-section">
          <div class="vibe-guide-label">1. Start annotating</div>
          <p class="vibe-guide-text">Click the <strong>pencil button</strong> or your configured hotkey to enter inspection mode. Click any element to add a comment or modify its design.</p>
        </div>

        <div class="vibe-guide-section">
          <div class="vibe-guide-label">2. Send to your agent</div>
          <p class="vibe-guide-text">Hit <strong>Copy</strong> in the toolbar and paste into any AI chat, or <strong>Export</strong> to share a file. No server needed.</p>
        </div>

        <div class="vibe-guide-section">
          <div class="vibe-guide-label">3. Install MCP server <span style="font-weight:400;color:var(--v-text-secondary);">(optional)</span></div>
          <p class="vibe-guide-text">Let your coding agent fetch and resolve annotations automatically.</p>
          <div class="vibe-guide-cmd" data-cmd="npm install -g vibe-annotations-server">
            <code>npm install -g vibe-annotations-server</code>
            <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
          </div>
          <div class="vibe-guide-cmd" data-cmd="vibe-annotations-server start">
            <code>vibe-annotations-server start</code>
            <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
          </div>
          <p class="vibe-guide-text" style="margin-top:8px;">Then connect your agent:</p>
          <div class="vibe-guide-tabs">
            <button class="vibe-guide-tab active" data-tab="claude">Claude Code</button>
            <button class="vibe-guide-tab" data-tab="cursor">Cursor</button>
            <button class="vibe-guide-tab" data-tab="windsurf">Windsurf</button>
            <button class="vibe-guide-tab" data-tab="codex">Codex</button>
            <button class="vibe-guide-tab" data-tab="openclaw">OpenClaw</button>
          </div>
          <div class="vibe-guide-panel active" data-panel="claude">
            <div class="vibe-guide-cmd" data-cmd="claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp">
              <code>claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-panel" data-panel="cursor">
            <p class="vibe-guide-text">Add to <strong>.cursor/mcp.json</strong>:</p>
            <div class="vibe-guide-cmd" data-cmd='{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}'>
              <code>{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-panel" data-panel="windsurf">
            <p class="vibe-guide-text">Add to Windsurf MCP settings:</p>
            <div class="vibe-guide-cmd" data-cmd='{"mcpServers":{"vibe-annotations":{"serverUrl":"http://127.0.0.1:3846/mcp"}}}'>
              <code>{"mcpServers":{"vibe-annotations":{"serverUrl":"http://127.0.0.1:3846/mcp"}}}</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-panel" data-panel="codex">
            <p class="vibe-guide-text">Add to <strong>~/.codex/config.toml</strong>:</p>
            <div class="vibe-guide-cmd" data-cmd="[mcp_servers.vibe-annotations]&#10;url = &quot;http://127.0.0.1:3846/mcp&quot;">
              <code>[mcp_servers.vibe-annotations] url = "..."</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-panel" data-panel="openclaw">
            <p class="vibe-guide-text">Add to <strong>~/.openclaw/openclaw.json</strong>:</p>
            <div class="vibe-guide-cmd" data-cmd='{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}'>
              <code>{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
        </div>
      </div>
    `;

    header.querySelector('.vibe-guide-back-btn').addEventListener('click', () => showDocumentation(dropdown, ICONS, callbacks));
    wireTabSwitching(body);
    wireCopyButtons(body, ICONS);
  }

  function showWorkflow(dropdown, type, ICONS, callbacks) {
    if (!dropdown) return;
    const header = dropdown.querySelector('.vibe-settings-header');
    const body = dropdown.querySelector('.vibe-settings-body');
    if (!header || !body) return;

    const workflows = {
      'mcp-setup': {
        title: 'MCP Server',
        content: `
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">1. Install and start the server</div>
            <div class="vibe-guide-cmd" data-cmd="npm install -g vibe-annotations-server">
              <code>npm install -g vibe-annotations-server</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
            <div class="vibe-guide-cmd" data-cmd="vibe-annotations-server start">
              <code>vibe-annotations-server start</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">2. Connect your agent</div>
            <div class="vibe-guide-tabs">
              <button class="vibe-guide-tab active" data-tab="claude">Claude Code</button>
              <button class="vibe-guide-tab" data-tab="cursor">Cursor</button>
              <button class="vibe-guide-tab" data-tab="windsurf">Windsurf</button>
              <button class="vibe-guide-tab" data-tab="codex">Codex</button>
              <button class="vibe-guide-tab" data-tab="openclaw">OpenClaw</button>
            </div>
            <div class="vibe-guide-panel active" data-panel="claude">
              <div class="vibe-guide-cmd" data-cmd="claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp">
                <code>claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp</code>
                <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
              </div>
            </div>
            <div class="vibe-guide-panel" data-panel="cursor">
              <p class="vibe-guide-text">Add to <strong>.cursor/mcp.json</strong>:</p>
              <div class="vibe-guide-cmd" data-cmd='{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}'>
                <code>{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}</code>
                <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
              </div>
            </div>
            <div class="vibe-guide-panel" data-panel="windsurf">
              <p class="vibe-guide-text">Add to Windsurf MCP settings:</p>
              <div class="vibe-guide-cmd" data-cmd='{"mcpServers":{"vibe-annotations":{"serverUrl":"http://127.0.0.1:3846/mcp"}}}'>
                <code>{"mcpServers":{"vibe-annotations":{"serverUrl":"http://127.0.0.1:3846/mcp"}}}</code>
                <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
              </div>
            </div>
            <div class="vibe-guide-panel" data-panel="codex">
              <p class="vibe-guide-text">Add to <strong>~/.codex/config.toml</strong>:</p>
              <div class="vibe-guide-cmd" data-cmd="[mcp_servers.vibe-annotations]&#10;url = &quot;http://127.0.0.1:3846/mcp&quot;">
                <code>[mcp_servers.vibe-annotations] url = "..."</code>
                <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
              </div>
            </div>
            <div class="vibe-guide-panel" data-panel="openclaw">
              <p class="vibe-guide-text">Add to <strong>~/.openclaw/openclaw.json</strong>:</p>
              <div class="vibe-guide-cmd" data-cmd='{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}'>
                <code>{"mcpServers":{"vibe-annotations":{"url":"http://127.0.0.1:3846/mcp"}}}</code>
                <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
              </div>
            </div>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">3. Watch mode <span style="font-weight:400;color:var(--v-text-secondary);">(hands-free)</span></div>
            <p class="vibe-guide-text">Your agent can automatically pick up annotations as you drop them. Just tell it:</p>
            <div class="vibe-guide-cmd" data-cmd="Start watching Vibe Annotations">
              <code>Start watching Vibe Annotations</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
            <p class="vibe-guide-text" style="margin-top:8px;">The agent calls <code>watch_annotations</code> in a loop, implements each change, and deletes the annotation when done. An eye icon appears in the toolbar and on badges while watching. Click the eye to stop.</p>
          </div>
        `
      },
      'single-page': {
        title: 'Editing a single page',
        content: `
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Best for quick edits</div>
            <p class="vibe-guide-text">For a few annotations on one page, <strong>copy & paste</strong> is the fastest option. No server, no setup.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Workflow</div>
            <p class="vibe-guide-text">1. Annotate elements on the page (comments, CSS tweaks, text changes)</p>
            <p class="vibe-guide-text">2. Click <strong>Copy</strong> in the toolbar</p>
            <p class="vibe-guide-text">3. Paste into any AI chat (Claude, ChatGPT, Cursor...) and ask the agent to implement the changes</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Tips</div>
            <p class="vibe-guide-text">Enable <strong>Clear on copy</strong> in settings to auto-delete annotations after copying. Keeps things clean between iterations.</p>
            <p class="vibe-guide-text">Each annotation includes the selector, your comment, element context, and any pending changes. The agent gets everything it needs to locate and edit the right code.</p>
          </div>
        `
      },
      'multi-page': {
        title: 'Editing multiple pages',
        content: `
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Best for cross-page changes</div>
            <p class="vibe-guide-text">When you're annotating across multiple routes, the <strong>MCP server</strong> is preferable. Your coding agent can read and resolve annotations from all pages at once, without manual copy-paste per route.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Setup</div>
            <div class="vibe-guide-cmd" data-cmd="npm install -g vibe-annotations-server">
              <code>npm install -g vibe-annotations-server</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
            <div class="vibe-guide-cmd" data-cmd="vibe-annotations-server start">
              <code>vibe-annotations-server start</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
            <p class="vibe-guide-text" style="margin-top:8px;">Then connect your agent (e.g. Claude Code):</p>
            <div class="vibe-guide-cmd" data-cmd="claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp">
              <code>claude mcp add --transport http vibe-annotations http://127.0.0.1:3846/mcp</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Workflow</div>
            <p class="vibe-guide-text">1. Navigate your app and annotate elements across as many routes as needed</p>
            <p class="vibe-guide-text">2. Tell your agent: <em>"read vibe annotations and implement the changes"</em></p>
            <p class="vibe-guide-text">3. The agent pulls all pending annotations via MCP, edits your source files, and deletes each one when done</p>
          </div>
        `
      },
      collaborate: {
        title: 'Collaborating with annotations',
        content: `
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Annotations as a feedback tool</div>
            <p class="vibe-guide-text">Anyone can annotate a website: add comments, tweak styles, edit text. Then <strong>export</strong> the annotations as a .json file and share it with a teammate.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Workflow</div>
            <p class="vibe-guide-text">1. A reviewer annotates the live site (staging, production, or localhost)</p>
            <p class="vibe-guide-text">2. They click <strong>Export</strong> and share the .json file (Slack, email, etc.)</p>
            <p class="vibe-guide-text">3. A developer clicks <strong>Import</strong> on their localhost. Annotations, badges, and style previews appear instantly.</p>
            <p class="vibe-guide-text">4. The developer copies or uses MCP to send the annotations to their coding agent</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Cross-origin remap</div>
            <p class="vibe-guide-text">Importing annotations from a public URL into localhost? The extension offers to <strong>remap URLs</strong> automatically so annotations anchor to your local dev server.</p>
          </div>
        `
      },
      'watch-mode': {
        title: 'Watch mode',
        content: `
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Hands-free annotation processing</div>
            <p class="vibe-guide-text">Your coding agent automatically picks up and implements annotations as you drop them. No copy-paste, no manual triggering. Requires the MCP server.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Start watching</div>
            <p class="vibe-guide-text">Tell your agent:</p>
            <div class="vibe-guide-cmd" data-cmd="Start watching Vibe Annotations">
              <code>Start watching Vibe Annotations</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
            <p class="vibe-guide-text" style="margin-top:8px;">The agent calls <code>watch_annotations</code> in a loop, implements each change, and deletes the annotation when done.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Visual feedback</div>
            <p class="vibe-guide-text">While watching, an eye icon replaces the copy button in the toolbar, and badges show eyes instead of numbers. Click the eye to stop watching.</p>
            <p class="vibe-guide-text">Auto-stops after 5 minutes of inactivity.</p>
          </div>
        `
      },
      agents: {
        title: 'Annotating with agents',
        content: `
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Let agents annotate for you</div>
            <p class="vibe-guide-text">Agents can help you annotate collaboratively, or work fully autonomously to review any site.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Compatible agents</div>
            <p class="vibe-guide-text"><strong>Claude Chrome extension</strong> has direct page access and can call the API from its javascript tool.</p>
            <p class="vibe-guide-text"><strong>OpenClaw</strong> uses CDP evaluate to run JS on the page.</p>
            <p class="vibe-guide-text"><strong>Claude Code, Cursor, Windsurf</strong> can access the page via a DevTools MCP server or Playwright.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Prompt to get started</div>
            <p class="vibe-guide-text">Copy this and paste it into your agent's chat to orient it towards the bridge API:</p>
            <div class="vibe-guide-cmd" data-cmd="Read window.__vibeAnnotations.help() and use this extension for my comments on this project.">
              <code>Read window.__vibeAnnotations.help() and use this extension for my comments on this project.</code>
              <button class="vibe-guide-copy" type="button">${ICONS.clipboard}</button>
            </div>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">Requirement</div>
            <p class="vibe-guide-text">The extension must be active on the page for the bridge API to be available. This works best when the agent uses <strong>your browser</strong> (Claude Chrome, DevTools MCP), since the extension is already installed.</p>
            <p class="vibe-guide-text">Agents that launch their own browser (Playwright, Puppeteer) won't have the extension loaded by default. This can be configured by passing the extension path at launch, but requires some local setup.</p>
          </div>
          <div class="vibe-guide-section">
            <div class="vibe-guide-label">How it works</div>
            <p class="vibe-guide-text">The agent calls <code>__vibeAnnotations.help()</code> to discover the API, then uses <strong>createStyleAnnotation</strong> for broad CSS changes and <strong>createAnnotation</strong> for single-element edits. Changes preview live in the browser and get recorded as annotations for a coding agent to implement in source.</p>
          </div>
        `
      }
    };

    const wf = workflows[type];
    if (!wf) return;

    header.innerHTML = `
      <button class="vibe-guide-back-btn" type="button" style="display:flex;align-items:center;gap:6px;background:none;border:none;cursor:pointer;color:var(--v-text-secondary);font-family:var(--v-font);font-size:13px;padding:0;">
        ${ICONS.back}
        <span style="color:var(--v-text-primary);font-weight:600;">${wf.title}</span>
      </button>
    `;

    body.innerHTML = `<div class="vibe-guide">${wf.content}</div>`;

    header.querySelector('.vibe-guide-back-btn').addEventListener('click', () => showDocumentation(dropdown, ICONS, callbacks));
    wireTabSwitching(body);
    wireCopyButtons(body, ICONS);
  }

  return { showDocumentation, showGetStartedGuide, showWorkflow };
})();

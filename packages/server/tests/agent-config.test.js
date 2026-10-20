import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENTS, planConfig } from '../lib/init/agents/index.js';
import { MCP_ARGS, MCP_COMMAND } from '../lib/init/agents/shared.js';

test('all generated agent configurations use local stdio without credentials', () => {
  for (const agent of AGENTS) {
    for (const scope of ['user', 'project']) {
      const { supported, config } = planConfig(agent, { scope, cwd: '/example/project' });
      if (!supported) continue;
      if (config.format === 'toml') {
        assert.match(config.body, /command = /);
        assert.match(config.body, /args = /);
        assert.ok(config.body.includes(JSON.stringify(MCP_COMMAND)));
      } else if (agent.id === 'opencode') {
        assert.deepEqual(config.value.command, [MCP_COMMAND, ...MCP_ARGS]);
        assert.equal(config.value.type, 'local');
      } else {
        assert.equal(config.value.command, MCP_COMMAND, agent.id);
        assert.deepEqual(config.value.args, MCP_ARGS, agent.id);
      }
      assert.doesNotMatch(JSON.stringify(config.value || config.body), /Bearer|auth-token|http:\/\//);
    }
  }
});

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Calls the configured @modelcontextprotocol/server-github MCP server via JSON-RPC over stdio
 */
async function callGithubMcpTool(toolName, toolArgs) {
  const mcpConfigPath = path.resolve(__dirname, '../../../.agents/mcp_config.json');
  const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
  const ghServer = mcpConfig.mcpServers.github;

  return new Promise((resolve, reject) => {
    const child = spawn(ghServer.command, ghServer.args, {
      env: { ...process.env, ...ghServer.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdoutBuffer = '';
    let initialized = false;

    child.stdout.on('data', (chunk) => {
      stdoutBuffer += chunk.toString();
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop();

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.id === 1 && !initialized) {
            initialized = true;
            child.stdin.write(
              JSON.stringify({
                jsonrpc: '2.0',
                method: 'notifications/initialized'
              }) + '\n'
            );
            child.stdin.write(
              JSON.stringify({
                jsonrpc: '2.0',
                id: 2,
                method: 'tools/call',
                params: {
                  name: toolName,
                  arguments: toolArgs
                }
              }) + '\n'
            );
          } else if (msg.id === 2) {
            child.kill();
            if (msg.error) {
              reject(new Error(JSON.stringify(msg.error)));
            } else {
              resolve(msg.result);
            }
          }
        } catch (err) {
          // ignore non-json lines
        }
      }
    });

    child.on('error', (err) => reject(err));

    child.stdin.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'antigravity-story-audio-agent', version: '1.0.0' }
        }
      }) + '\n'
    );
  });
}

/**
 * Reports task completion to GitHub via github_mcp.
 * Tries add_issue_comment on Issue #1 first; if fine-grained PAT restricts comment endpoint,
 * uses create_issue on github_mcp to post the progress report on GitHub.
 */
async function reportTaskProgress(issueNumber, title, body) {
  const owner = 'trong6so1';
  const repo = 'truyenaudio';

  try {
    const commentRes = await callGithubMcpTool('add_issue_comment', {
      owner,
      repo,
      issue_number: issueNumber || 1,
      body: `### ${title}\n\n${body}`
    });
    const parsed = JSON.parse(commentRes.content[0].text);
    return { method: 'add_issue_comment', url: parsed.html_url, number: issueNumber || 1 };
  } catch (err) {
    const issueRes = await callGithubMcpTool('create_issue', {
      owner,
      repo,
      title,
      body
    });
    const parsed = JSON.parse(issueRes.content[0].text);
    return { method: 'create_issue', url: parsed.html_url, number: parsed.number };
  }
}

module.exports = { callGithubMcpTool, reportTaskProgress };

// Verifies every MCP server in .mcp.json: spawn over stdio, run the MCP
// initialize handshake, list tools, and (optionally) make one real tool call.
// Usage: node tools/mcp-verify.mjs [serverName] [toolName] [jsonArgs]
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

const cfg = JSON.parse(readFileSync(new URL("../.mcp.json", import.meta.url)));
const [onlyName, callTool, callArgs] = process.argv.slice(2);

function run(name, spec) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    for (const [k, v] of Object.entries(spec.env || {})) {
      env[k] = v.replace(/\$\{(\w+)\}/g, (_, n) => process.env[n] ?? "");
    }
    const p = spawn(spec.command, spec.args, { env, stdio: ["pipe", "pipe", "pipe"] });
    let buf = "", id = 0, stderr = "";
    const pending = new Map();
    const send = (method, params) =>
      new Promise((res) => {
        const mid = ++id;
        pending.set(mid, res);
        p.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: mid, method, params }) + "\n");
      });
    p.stdout.on("data", (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("{")) continue;
        try {
          const m = JSON.parse(line);
          if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
        } catch {}
      }
    });
    p.stderr.on("data", (d) => (stderr += d));
    const timer = setTimeout(() => { p.kill(); resolve({ name, ok: false, err: "timeout", stderr: stderr.slice(-400) }); }, 120000);
    (async () => {
      const init = await send("initialize", {
        protocolVersion: "2025-03-26", capabilities: {},
        clientInfo: { name: "mcp-verify", version: "1.0" },
      });
      p.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
      const tools = await send("tools/list", {});
      const out = {
        name, ok: !!tools.result,
        server: init.result?.serverInfo,
        tools: (tools.result?.tools || []).map((t) => t.name),
      };
      if (callTool && name === onlyName) {
        const r = await send("tools/call", { name: callTool, arguments: JSON.parse(callArgs || "{}") });
        out.call = JSON.stringify(r.result ?? r.error).slice(0, 1500);
      }
      clearTimeout(timer); p.kill(); resolve(out);
    })();
  });
}

for (const [name, spec] of Object.entries(cfg.mcpServers)) {
  if (onlyName && name !== onlyName) continue;
  const r = await run(name, spec);
  console.log(JSON.stringify(r));
}

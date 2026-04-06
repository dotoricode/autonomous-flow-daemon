import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { resolveHookCommand } from "../platform";
import {
  readHooksFile,
  writeHooksFile,
  mergeHooks,
  getAfdDesiredHooks,
  KNOWN_AFD_HOOKS,
} from "../core/hook-manager";

export interface HarnessSchema {
  configFiles: string[];
  ignoreFile: string | null;
  rulesFile: string | null;
  hooksFile: string | null;
}

export interface EcosystemAdapter {
  name: string;
  detect(cwd: string): boolean;
  getHarnessSchema(): HarnessSchema;
  injectHooks?(cwd: string): { injected: boolean; message: string };
  configureStatusLine?(cwd: string): { configured: boolean; message: string };
  registerMcp?(cwd: string): { registered: boolean; message: string };
  removeHooks?(cwd: string): { removed: boolean; message: string };
  unregisterMcp?(cwd: string): { removed: boolean; message: string };
}

const AFD_HOOK_MARKER = "afd-auto-heal";

interface HooksConfig {
  hooks?: Record<string, HookEntry[]>;
  [key: string]: unknown;
}

interface HookEntry {
  matcher?: string;
  command: string;
  id?: string;
  [key: string]: unknown;
}

export const ClaudeCodeAdapter: EcosystemAdapter = {
  name: "Claude Code",
  detect(cwd: string): boolean {
    return (
      existsSync(join(cwd, ".claude")) ||
      existsSync(join(cwd, "CLAUDE.md"))
    );
  },
  getHarnessSchema(): HarnessSchema {
    return {
      configFiles: [".claude/settings.json", ".claude/settings.local.json", "CLAUDE.md"],
      ignoreFile: ".claudeignore",
      rulesFile: "CLAUDE.md",
      hooksFile: ".claude/hooks.json",
    };
  },
  injectHooks(cwd: string): { injected: boolean; message: string } {
    const hooksPath = join(cwd, ".claude", "hooks.json");
    const config = readHooksFile(hooksPath);

    if (!config.hooks || Array.isArray(config.hooks) || typeof config.hooks !== "object") {
      config.hooks = {};
    }
    if (!config.hooks.PreToolUse) config.hooks.PreToolUse = [];

    const before = config.hooks.PreToolUse.length;
    const result = mergeHooks(config.hooks.PreToolUse, getAfdDesiredHooks());
    config.hooks.PreToolUse = result.merged;
    writeHooksFile(hooksPath, config);

    const added = result.changes.added.length > 0;
    const after = config.hooks.PreToolUse.length;
    if (added) {
      return { injected: true, message: "Auto-heal hook injected into PreToolUse" };
    }
    return {
      injected: false,
      message: `Auto-heal hook already present (${after} hook${after !== 1 ? "s" : ""} total, ordering: afd → omc → user)`,
    };
  },
  configureStatusLine(cwd: string): { configured: boolean; message: string } {
    const settingsPath = join(cwd, ".claude", "settings.local.json");
    const statusScript = join(cwd, ".claude", "statusline-command.js").replace(/\\/g, "/");

    // Only configure if the statusline-command.js exists
    if (!existsSync(statusScript)) {
      return { configured: false, message: "No statusline-command.js found" };
    }

    let settings: Record<string, unknown>;
    if (existsSync(settingsPath)) {
      try {
        settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      } catch {
        settings = {};
      }
    } else {
      mkdirSync(dirname(settingsPath), { recursive: true });
      settings = {};
    }

    const expectedCommand = `node ${statusScript}`;
    const current = settings.statusLine as { type?: string; command?: string } | undefined;

    if (current?.type === "command" && current?.command === expectedCommand) {
      return { configured: false, message: "Status line already configured" };
    }

    settings.statusLine = { type: "command", command: expectedCommand };
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
    return { configured: true, message: "Status line configured with afd integration" };
  },
  registerMcp(cwd: string): { registered: boolean; message: string } {
    const mcpPath = join(cwd, ".mcp.json");

    // Dev mode: cwd is the afd source tree itself
    const isDevMode = existsSync(join(cwd, "src/daemon/server.ts"));
    const command = isDevMode ? "bun" : "npx";
    const expectedArgs = isDevMode
      ? ["run", "src/daemon/server.ts", "--mcp"]
      : ["-y", "@dotoricode/afd", "start", "--mcp"];

    let config: Record<string, unknown>;
    if (existsSync(mcpPath)) {
      try {
        config = JSON.parse(readFileSync(mcpPath, "utf-8"));
      } catch {
        config = {};
      }
    } else {
      config = {};
    }

    const mcpServers = (config.mcpServers ?? {}) as Record<string, unknown>;
    const existing = mcpServers.afd as { command?: string; args?: string[] } | undefined;

    if (existing?.command === command &&
        JSON.stringify(existing.args) === JSON.stringify(expectedArgs)) {
      return { registered: false, message: "MCP server already registered in .mcp.json" };
    }

    mcpServers.afd = { command, args: expectedArgs };
    config.mcpServers = mcpServers;
    writeFileSync(mcpPath, JSON.stringify(config, null, 2), "utf-8");
    return { registered: true, message: "MCP server 'afd' registered in .mcp.json" };
  },
  removeHooks(cwd: string): { removed: boolean; message: string } {
    const hooksPath = join(cwd, ".claude", "hooks.json");
    if (!existsSync(hooksPath)) {
      return { removed: false, message: "No hooks file found" };
    }
    try {
      const config: HooksConfig = JSON.parse(readFileSync(hooksPath, "utf-8"));
      const arr = config.hooks?.PreToolUse;
      if (!arr) return { removed: false, message: "No PreToolUse hooks" };

      // Only remove hooks that are in the canonical KNOWN_AFD_HOOKS set.
      // User hooks with an `afd-` prefix (e.g., afd-read-gate) are preserved.
      const before = arr.length;
      config.hooks!.PreToolUse = arr.filter(
        (h: HookEntry) => !KNOWN_AFD_HOOKS.has(h.id ?? "")
      );
      const removed = before - config.hooks!.PreToolUse.length;
      if (removed === 0) return { removed: false, message: "No afd-managed hooks found" };

      writeHooksFile(hooksPath, config);
      return { removed: true, message: `Removed ${removed} afd-managed hook${removed !== 1 ? "s" : ""} from PreToolUse` };
    } catch {
      return { removed: false, message: "Failed to parse hooks file" };
    }
  },
  unregisterMcp(cwd: string): { removed: boolean; message: string } {
    const mcpPath = join(cwd, ".mcp.json");
    if (!existsSync(mcpPath)) {
      return { removed: false, message: "No .mcp.json found" };
    }
    try {
      const config = JSON.parse(readFileSync(mcpPath, "utf-8"));
      const servers = config.mcpServers as Record<string, unknown> | undefined;
      if (!servers?.afd) return { removed: false, message: "afd not in .mcp.json" };
      delete servers.afd;
      if (Object.keys(servers).length === 0) delete config.mcpServers;
      writeFileSync(mcpPath, JSON.stringify(config, null, 2), "utf-8");
      return { removed: true, message: "MCP server 'afd' removed from .mcp.json" };
    } catch {
      return { removed: false, message: "Failed to parse .mcp.json" };
    }
  },
};

export const CursorAdapter: EcosystemAdapter = {
  name: "Cursor",
  detect(cwd: string): boolean {
    return existsSync(join(cwd, ".cursorrules")) || existsSync(join(cwd, ".cursor"));
  },
  getHarnessSchema(): HarnessSchema {
    return {
      configFiles: [".cursorrules", ".cursor/settings.json"],
      ignoreFile: ".cursorignore",
      rulesFile: ".cursorrules",
      hooksFile: ".cursor/hooks.json",
    };
  },
  injectHooks(cwd: string): { injected: boolean; message: string } {
    // Cursor supports hooks via .cursor/hooks.json (same format as Claude Code)
    const hooksPath = join(cwd, ".cursor", "hooks.json");
    const hookCommand = resolveHookCommand();

    const newHook: HookEntry = {
      id: AFD_HOOK_MARKER,
      matcher: "",
      command: hookCommand,
    };

    let config: HooksConfig;
    if (existsSync(hooksPath)) {
      try {
        config = JSON.parse(readFileSync(hooksPath, "utf-8"));
      } catch {
        config = { hooks: {} };
      }
    } else {
      mkdirSync(join(cwd, ".cursor"), { recursive: true });
      config = { hooks: {} };
    }

    if (!config.hooks || Array.isArray(config.hooks) || typeof config.hooks !== "object") {
      config.hooks = {};
    }
    if (!config.hooks.PreToolUse) config.hooks.PreToolUse = [];

    const existing = config.hooks.PreToolUse.find((h: HookEntry) => h.id === AFD_HOOK_MARKER);
    if (existing) {
      existing.command = hookCommand;
      writeFileSync(hooksPath, JSON.stringify(config, null, 2), "utf-8");
      return { injected: false, message: "Cursor: auto-heal hook already present (updated)" };
    }

    config.hooks.PreToolUse.push(newHook);
    writeFileSync(hooksPath, JSON.stringify(config, null, 2), "utf-8");
    return { injected: true, message: "Cursor: auto-heal hook injected" };
  },
};

export const WindsurfAdapter: EcosystemAdapter = {
  name: "Windsurf",
  detect(cwd: string): boolean {
    return existsSync(join(cwd, ".windsurfrules")) || existsSync(join(cwd, ".windsurf"));
  },
  getHarnessSchema(): HarnessSchema {
    return {
      configFiles: [".windsurfrules", ".windsurf/settings.json"],
      ignoreFile: ".windsurfignore",
      rulesFile: ".windsurfrules",
      hooksFile: ".windsurf/hooks.json",
    };
  },
  injectHooks(cwd: string): { injected: boolean; message: string } {
    const hooksPath = join(cwd, ".windsurf", "hooks.json");
    const hookCommand = resolveHookCommand();

    const newHook: HookEntry = {
      id: AFD_HOOK_MARKER,
      matcher: "",
      command: hookCommand,
    };

    let config: HooksConfig;
    if (existsSync(hooksPath)) {
      try {
        config = JSON.parse(readFileSync(hooksPath, "utf-8"));
      } catch {
        config = { hooks: {} };
      }
    } else {
      mkdirSync(join(cwd, ".windsurf"), { recursive: true });
      config = { hooks: {} };
    }

    if (!config.hooks || Array.isArray(config.hooks) || typeof config.hooks !== "object") {
      config.hooks = {};
    }
    if (!config.hooks.PreToolUse) config.hooks.PreToolUse = [];

    const existing = config.hooks.PreToolUse.find((h: HookEntry) => h.id === AFD_HOOK_MARKER);
    if (existing) {
      existing.command = hookCommand;
      writeFileSync(hooksPath, JSON.stringify(config, null, 2), "utf-8");
      return { injected: false, message: "Windsurf: auto-heal hook already present (updated)" };
    }

    config.hooks.PreToolUse.push(newHook);
    writeFileSync(hooksPath, JSON.stringify(config, null, 2), "utf-8");
    return { injected: true, message: "Windsurf: auto-heal hook injected" };
  },
};

export const CodexAdapter: EcosystemAdapter = {
  name: "Codex",
  detect(cwd: string): boolean {
    return existsSync(join(cwd, "codex.md")) || existsSync(join(cwd, ".codex"));
  },
  getHarnessSchema(): HarnessSchema {
    return {
      configFiles: ["codex.md", ".codex/settings.json"],
      ignoreFile: ".codexignore",
      rulesFile: "codex.md",
      hooksFile: ".codex/hooks.json",
    };
  },
  injectHooks(cwd: string): { injected: boolean; message: string } {
    const hooksPath = join(cwd, ".codex", "hooks.json");
    const hookCommand = resolveHookCommand();

    const newHook: HookEntry = {
      id: AFD_HOOK_MARKER,
      matcher: "",
      command: hookCommand,
    };

    let config: HooksConfig;
    if (existsSync(hooksPath)) {
      try {
        config = JSON.parse(readFileSync(hooksPath, "utf-8"));
      } catch {
        config = { hooks: {} };
      }
    } else {
      mkdirSync(join(cwd, ".codex"), { recursive: true });
      config = { hooks: {} };
    }

    if (!config.hooks || Array.isArray(config.hooks) || typeof config.hooks !== "object") {
      config.hooks = {};
    }
    if (!config.hooks.PreToolUse) config.hooks.PreToolUse = [];

    const existing = config.hooks.PreToolUse.find((h: HookEntry) => h.id === AFD_HOOK_MARKER);
    if (existing) {
      existing.command = hookCommand;
      writeFileSync(hooksPath, JSON.stringify(config, null, 2), "utf-8");
      return { injected: false, message: "Codex: auto-heal hook already present (updated)" };
    }

    config.hooks.PreToolUse.push(newHook);
    writeFileSync(hooksPath, JSON.stringify(config, null, 2), "utf-8");
    return { injected: true, message: "Codex: auto-heal hook injected" };
  },
};

const adapters: EcosystemAdapter[] = [ClaudeCodeAdapter, CursorAdapter, WindsurfAdapter, CodexAdapter];

export interface DetectionResult {
  adapter: EcosystemAdapter;
  confidence: "primary" | "secondary";
}

export function detectEcosystem(cwd: string): DetectionResult[] {
  const results: DetectionResult[] = [];
  for (const adapter of adapters) {
    if (adapter.detect(cwd)) {
      results.push({
        adapter,
        confidence: results.length === 0 ? "primary" : "secondary",
      });
    }
  }
  return results;
}

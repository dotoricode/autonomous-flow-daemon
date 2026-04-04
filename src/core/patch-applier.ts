import { writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname } from "path";
import type { PatchOp } from "./immune";

/**
 * Apply a single RFC 6902 JSON-Patch operation to the filesystem.
 * Returns true if the patch was applied successfully.
 */
export function applyPatch(patch: PatchOp): boolean {
  const filePath = patch.path.replace(/^\//, "");

  // Guard: reject path traversal attempts
  if (filePath.includes("..") || filePath.startsWith("/") || /^[A-Za-z]:/.test(filePath)) return false;

  if (patch.op === "add") {
    if (existsSync(filePath)) return false;
    const dir = dirname(filePath);
    if (dir !== ".") mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, patch.value ?? "", "utf-8");
    return true;
  }

  if (patch.op === "replace") {
    const dir = dirname(filePath);
    if (dir !== ".") mkdirSync(dir, { recursive: true });
    writeFileSync(filePath, patch.value ?? "", "utf-8");
    return true;
  }

  return false;
}

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "..", "package.json"), "utf-8"),
);

export const APP_VERSION: string = pkg.version;

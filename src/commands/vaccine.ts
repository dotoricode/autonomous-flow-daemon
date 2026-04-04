/**
 * afd vaccine — Vaccine registry CLI
 *
 * Sub-commands:
 *   afd vaccine list              — list available packages
 *   afd vaccine search <query>    — search packages
 *   afd vaccine install <name>    — install a vaccine package
 *   afd vaccine publish <file>    — publish a vaccine package
 *   afd vaccine installed         — list installed packages
 */

import { readFileSync, existsSync } from "fs";
import {
  publishPackage,
  searchPackages,
  installPackage,
  listInstalled,
  getPackage,
} from "../core/vaccine-registry";
import type { VaccinePackage } from "../core/vaccine-registry";
import { getSystemLanguage } from "../core/locale";
import { createBox } from "../core/ui-box";

const msgs = {
  en: {
    title: "afd vaccine — Registry",
    list: "Available Packages",
    search: "Search Results",
    install: "Install",
    publish: "Publish",
    installed: "Installed Packages",
    noPackages: "No packages found.",
    noResults: "No matching packages.",
    notFound: "Package not found.",
    usage: `Usage:
  afd vaccine list              List available packages
  afd vaccine search <query>    Search packages
  afd vaccine install <name>    Install a vaccine package
  afd vaccine publish <file>    Publish from vaccine.json
  afd vaccine installed         List installed packages`,
  },
  ko: {
    title: "afd vaccine — 레지스트리",
    list: "사용 가능한 패키지",
    search: "검색 결과",
    install: "설치",
    publish: "발행",
    installed: "설치된 패키지",
    noPackages: "패키지가 없습니다.",
    noResults: "일치하는 패키지가 없습니다.",
    notFound: "패키지를 찾을 수 없습니다.",
    usage: `사용법:
  afd vaccine list              사용 가능한 패키지 목록
  afd vaccine search <query>    패키지 검색
  afd vaccine install <name>    백신 패키지 설치
  afd vaccine publish <file>    vaccine.json에서 발행
  afd vaccine installed         설치된 패키지 목록`,
  },
};

const { hline, row } = createBox(54);

export async function vaccineCommand(subcommand?: string, arg?: string) {
  const lang = getSystemLanguage();
  const m = msgs[lang];

  if (!subcommand) {
    console.log(m.usage);
    return;
  }

  switch (subcommand) {
    case "list": {
      const packages = searchPackages();
      console.log(hline(BOX.tl, BOX.tr));
      console.log(row(`💉 ${m.title} — ${m.list}`));
      console.log(hline(BOX.ml, BOX.mr));
      if (packages.length === 0) {
        console.log(row(m.noPackages));
      } else {
        for (const p of packages) {
          console.log(row(`📦 ${p.name}@${p.version} (${p.antibodyCount} rules)`));
          console.log(row(`   ${p.description}`));
          console.log(row(`   ${p.ecosystem} | by ${p.author}`));
          console.log(row(""));
        }
      }
      console.log(hline(BOX.bl, BOX.br));
      break;
    }

    case "search": {
      const results = searchPackages(arg);
      console.log(hline(BOX.tl, BOX.tr));
      console.log(row(`🔍 ${m.title} — ${m.search}: "${arg ?? ""}"`));
      console.log(hline(BOX.ml, BOX.mr));
      if (results.length === 0) {
        console.log(row(m.noResults));
      } else {
        for (const p of results) {
          console.log(row(`📦 ${p.name}@${p.version} — ${p.description}`));
        }
      }
      console.log(hline(BOX.bl, BOX.br));
      break;
    }

    case "install": {
      if (!arg) {
        console.error("Usage: afd vaccine install <name>");
        process.exit(1);
      }
      const result = installPackage(arg);
      if (!result.success) {
        console.error(`[afd vaccine] ${result.message}`);
        process.exit(1);
      }
      console.log(hline(BOX.tl, BOX.tr));
      console.log(row(`✅ ${m.install}: ${arg}`));
      console.log(hline(BOX.ml, BOX.mr));
      console.log(row(result.message));
      console.log(hline(BOX.bl, BOX.br));
      break;
    }

    case "publish": {
      const filePath = arg ?? "vaccine.json";
      if (!existsSync(filePath)) {
        console.error(`[afd vaccine] File not found: ${filePath}`);
        process.exit(1);
      }
      let pkg: VaccinePackage;
      try {
        pkg = JSON.parse(readFileSync(filePath, "utf-8"));
      } catch {
        console.error("[afd vaccine] Invalid JSON in vaccine file.");
        process.exit(1);
      }
      const result = publishPackage(pkg);
      console.log(hline(BOX.tl, BOX.tr));
      console.log(row(`📤 ${m.publish}`));
      console.log(hline(BOX.ml, BOX.mr));
      console.log(row(result.message));
      console.log(hline(BOX.bl, BOX.br));
      break;
    }

    case "installed": {
      const pkgs = listInstalled();
      console.log(hline(BOX.tl, BOX.tr));
      console.log(row(`📋 ${m.title} — ${m.installed}`));
      console.log(hline(BOX.ml, BOX.mr));
      if (pkgs.length === 0) {
        console.log(row(m.noPackages));
      } else {
        for (const name of pkgs) {
          const pkg = getPackage(name);
          if (pkg) {
            console.log(row(`📦 ${pkg.name}@${pkg.version} (${pkg.antibodies.length} rules)`));
          } else {
            console.log(row(`📦 ${name}`));
          }
        }
      }
      console.log(hline(BOX.bl, BOX.br));
      break;
    }

    default:
      console.log(m.usage);
  }
}

#!/usr/bin/env node
/**
 * 构建内置剧本索引
 *
 * 扫描 "剧本JSON（SE整理版）" 目录，生成 public/scripts-index.json
 * 并将 JSON 文件复制到 public/scripts/ 供浏览器按需加载
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "剧本JSON（SE整理版）");
const OUTPUT_INDEX = path.join(ROOT, "public", "scripts-index.json");
const OUTPUT_DIR = path.join(ROOT, "public", "scripts");

const TEAM_LABELS = {
  townsfolk: "镇民",
  outsider: "外来者",
  minion: "爪牙",
  demon: "恶魔",
  traveler: "旅行者",
  fabled: "传奇"
};

function scanScripts(dir, category = "") {
  const results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      const subCategory = category || entry.name;
      results.push(...scanScripts(fullPath, subCategory));
    } else if (entry.name.endsWith(".json")) {
      try {
        const raw = fs.readFileSync(fullPath, "utf8");
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) continue;

        const meta = data.find(r => r.id === "_meta") || {};
        const roles = data.filter(r => r.id !== "_meta");

        const teams = {};
        roles.forEach(r => {
          if (r.team) teams[r.team] = (teams[r.team] || 0) + 1;
        });

        const relPath = path.relative(SOURCE_DIR, fullPath);
        // 用一级目录名作为分类
        const topCategory = category || path.dirname(relPath);

        results.push({
          name: meta.name || path.basename(entry.name, ".json").replace(/^#/, ""),
          author: meta.author || "",
          category: topCategory,
          file: "scripts/" + relPath.replace(/\\/g, "/"),
          players: roles.filter(r => r.team !== "traveler").length
        });
      } catch (e) {
        // skip invalid files
      }
    }
  }
  return results;
}

function copyScripts(sourceDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(sourceDir, entry.name);
    const dstPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyScripts(srcPath, dstPath);
    } else if (entry.name.endsWith(".json")) {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

// --- Main ---
console.log("扫描剧本目录:", SOURCE_DIR);
const scripts = scanScripts(SOURCE_DIR);
console.log(`找到 ${scripts.length} 个剧本`);

// 按分类排序
scripts.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

// 统计分类
const categories = [...new Set(scripts.map(s => s.category))].sort();
console.log(`共 ${categories.length} 个分类:`, categories.join(", "));

// 写入索引
fs.writeFileSync(OUTPUT_INDEX, JSON.stringify(scripts, null, 2), "utf8");
console.log(`索引写入: ${OUTPUT_INDEX}`);

// 复制 JSON 文件
console.log("复制剧本文件到 public/scripts/ ...");
copyScripts(SOURCE_DIR, OUTPUT_DIR);
console.log("完成!");

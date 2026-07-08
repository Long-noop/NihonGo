#!/usr/bin/env node
/**
 * Script to generate @font-face CSS from locally stored fonts
 * Scans asserts/fonts/ for .woff2 files and creates asserts/fonts.css
 */

const fs = require("fs");
const path = require("path");

const fontsDir = path.join(__dirname, "asserts", "fonts");
const outputFile = path.join(__dirname, "asserts", "fonts.css");

// Font family mapping based on filename patterns
const fontFamilies = {
  notoSerifJp: { name: "Noto Serif JP", weights: {} },
  notoSansJp: { name: "Noto Sans JP", weights: {} },
  inter: { name: "Inter", weights: {} },
};

// Weight mapping from filename
function extractWeight(filename) {
  const match = filename.match(/w(\d+)/);
  return match ? parseInt(match[1]) : 400;
}

// Check if fonts directory exists
if (!fs.existsSync(fontsDir)) {
  console.error(`❌ Fonts directory not found: ${fontsDir}`);
  console.error(
    "Run: powershell -ExecutionPolicy Bypass -File download-fonts.ps1",
  );
  process.exit(1);
}

// Scan for .woff2 files
const files = fs.readdirSync(fontsDir).filter((f) => f.endsWith(".woff2"));

if (files.length === 0) {
  console.error(`❌ No .woff2 files found in ${fontsDir}`);
  console.error(
    "Run: powershell -ExecutionPolicy Bypass -File download-fonts.ps1",
  );
  process.exit(1);
}

console.log(`📦 Found ${files.length} font files:`);

// Group files by family
files.forEach((file) => {
  console.log(`  • ${file}`);

  // Determine font family
  let family = null;
  if (file.includes("notoSerifJp")) family = "notoSerifJp";
  else if (file.includes("notoSansJp")) family = "notoSansJp";
  else if (file.includes("inter")) family = "inter";

  if (family && fontFamilies[family]) {
    const weight = extractWeight(file);
    if (!fontFamilies[family].weights[weight]) {
      fontFamilies[family].weights[weight] = [];
    }
    fontFamilies[family].weights[weight].push(file);
  }
});

// Generate @font-face CSS
let cssContent = `/* Generated @font-face definitions for local fonts */
/* This file was auto-generated. Do not edit manually */

`;

Object.entries(fontFamilies).forEach(([key, family]) => {
  const weights = Object.keys(family.weights).sort((a, b) => a - b);

  weights.forEach((weight) => {
    family.weights[weight].forEach((filename) => {
      const relativePath = `./asserts/fonts/${filename}`;
      cssContent += `@font-face {
  font-family: '${family.name}';
  font-weight: ${weight};
  font-style: normal;
  font-display: swap;
  src: url('${relativePath}') format('woff2');
}

`;
    });
  });
});

// Write CSS file
try {
  fs.writeFileSync(outputFile, cssContent, "utf-8");
  console.log(`\n✅ Generated: asserts/fonts.css`);
  console.log(
    `📝 Contains ${Object.values(fontFamilies).reduce((sum, f) => sum + Object.keys(f.weights).length, 0)} @font-face definitions`,
  );
  console.log("\n📌 Next steps:");
  console.log("1. Update asserts/styles.css: Remove Google Fonts CDN links");
  console.log('2. Add at top of asserts/styles.css: @import "./fonts.css";');
  console.log("3. Update index.html: Remove Google Fonts <link> tags");
  console.log('4. Update sw.js: Add "asserts/fonts/" to precache');
} catch (err) {
  console.error(`❌ Failed to write ${outputFile}:`, err.message);
  process.exit(1);
}

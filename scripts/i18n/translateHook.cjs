#!/usr/bin/env node
'use strict';

const path = require('node:path');
const fs = require('node:fs');

const LOCALES = [
  'cy-GB', 'de-DE', 'en-GB', 'en-US', 'es-CL', 'es-ES',
  'fr-CA', 'fr-FR', 'it-IT', 'nb-NO', 'nl',
  'pt-BR', 'pt-PT', 'ru-RU', 'sv-SE', 'zh-CN',
];

const masterPath = path.join(__dirname, 'resource-locale_master.json');
const srcLocalesDir = path.join(__dirname, '../../client/src/i18n/locales');
const publicLocalesDir = path.join(__dirname, '../../client/public/locales');

function sortObjectKeys(obj) {
  return Object.fromEntries(
    Object.keys(obj).sort().map(k => [k, obj[k]])
  );
}

function generateLanguage() {
  const master = JSON.parse(fs.readFileSync(masterPath, 'utf-8'));

  // Sort master entries by key alphabetically and write back
  const sortedMaster = [...master].sort((a, b) => a.key.localeCompare(b.key));
  fs.writeFileSync(masterPath, JSON.stringify(sortedMaster, null, 2) + '\n', 'utf-8');

  if (!fs.existsSync(srcLocalesDir)) {
    fs.mkdirSync(srcLocalesDir, { recursive: true });
  }

  for (const locale of LOCALES) {
    const out = {};
    for (const entry of sortedMaster) {
      if (Object.hasOwn(entry, locale)) {
        out[entry.key] = entry[locale];
      }
    }
    const sortedOut = sortObjectKeys(out);
    const dest = path.join(srcLocalesDir, `${locale}.json`);
    fs.writeFileSync(dest, JSON.stringify(sortedOut, null, 2) + '\n', 'utf-8');
    console.log(`  - Generated ${locale}.json (${Object.keys(sortedOut).length} keys)`);
  }

  console.log(`\nLocale files written to: ${srcLocalesDir}\n`);
}

function copyLanguages() {
  if (!fs.existsSync(publicLocalesDir)) {
    fs.mkdirSync(publicLocalesDir, { recursive: true });
  }

  const files = fs.readdirSync(srcLocalesDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const src = path.join(srcLocalesDir, file);
    const dst = path.join(publicLocalesDir, file);
    fs.copyFileSync(src, dst);
    console.log(`  - Copied ${file} → public/locales/`);
  }

  console.log(`\nPublic locale files at: ${publicLocalesDir}\n`);
}

module.exports = { generateLanguage, copyLanguages };

#!/usr/bin/env node
'use strict';

const child = require('node:child_process');
const translateHook = require('./translateHook.cjs');

console.log('Patent Workbench — i18n locale generator\n');

// Check if Perl is installed
child.exec('perl -v', error => {
  if (error) {
    // eslint-disable-next-line no-console
    console.error('Perl is not installed. Please install perl and run the command again.\r\n');
    process.exit(1);
  } else {
    console.log('Generating locale packages from resource-locale_master.json...\n');
    translateHook.generateLanguage();
    console.log('Copying locale packages to public/locales/...');
    translateHook.copyLanguages();
    console.log('Done.');
  }
});

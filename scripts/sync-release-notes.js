#!/usr/bin/env node

/**
 * Sync Release Notes Script
 *
 * This script reads the CHANGELOG.md file and converts it to plain text
 * format suitable for Android release notes, then writes it to
 * android/release-notes.txt
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
const releaseNotesPath = path.join(__dirname, '..', 'android', 'release-notes.txt');

function convertMarkdownToPlainText(markdown) {
  return markdown
    // Remove markdown headers formatting but keep the text
    .replace(/^#+\s*(.+)$/gm, '$1')
    // Remove markdown links but keep the text
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Remove emphasis markers
    .replace(/\*\*([^\*]+)\*\*/g, '$1')
    .replace(/\*([^\*]+)\*/g, '$1')
    // Remove code formatting
    .replace(/`([^`]+)`/g, '$1')
    // Clean up extra whitespace
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

try {
  // Read the changelog
  const changelogContent = fs.readFileSync(changelogPath, 'utf8');

  // Convert to plain text
  const plainTextContent = convertMarkdownToPlainText(changelogContent);

  // Write to release notes
  fs.writeFileSync(releaseNotesPath, plainTextContent, 'utf8');

  console.log('✅ Release notes synchronized successfully!');
  console.log(`📄 Updated: ${releaseNotesPath}`);

} catch (error) {
  console.error('❌ Error syncing release notes:', error.message);
  process.exit(1);
}
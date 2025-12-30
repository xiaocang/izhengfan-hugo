#!/usr/bin/env node

/**
 * Import comments JSON to Cloudflare D1
 *
 * Usage:
 *   node scripts/import-to-d1.js <comments.json> [--dry-run]
 *
 * This script generates SQL and executes it via wrangler d1 execute
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Escape string for SQL
function escapeSQL(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

// Main
function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const inputFile = args.find(a => !a.startsWith('--'));

  if (!inputFile) {
    console.log('Usage: node import-to-d1.js <comments.json> [--dry-run]');
    console.log('');
    console.log('Options:');
    console.log('  --dry-run  Generate SQL file without executing');
    process.exit(1);
  }

  // Check input file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  console.log(`Reading ${inputFile}...`);
  const data = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  const comments = data.comments || data;

  if (!Array.isArray(comments) || comments.length === 0) {
    console.error('Error: No comments found in JSON file');
    process.exit(1);
  }

  console.log(`Found ${comments.length} comments to import`);

  // Generate SQL
  const sqlStatements = [];

  // Use a transaction for better performance
  sqlStatements.push('BEGIN TRANSACTION;');

  for (const comment of comments) {
    const sql = `INSERT INTO comments (url, name, email, content, created_at) VALUES (${escapeSQL(comment.url)}, ${escapeSQL(comment.name)}, ${comment.email ? escapeSQL(comment.email) : 'NULL'}, ${escapeSQL(comment.content)}, ${escapeSQL(comment.created_at)});`;
    sqlStatements.push(sql);
  }

  sqlStatements.push('COMMIT;');

  const sqlContent = sqlStatements.join('\n');
  const sqlFile = inputFile.replace(/\.json$/i, '-import.sql');

  // Write SQL file
  fs.writeFileSync(sqlFile, sqlContent);
  console.log(`Generated ${sqlFile}`);

  if (dryRun) {
    console.log('\n--dry-run specified, not executing SQL');
    console.log(`\nTo import manually, run:`);
    console.log(`  npx wrangler d1 execute blog-comments --file=${sqlFile}`);
    return;
  }

  // Execute via wrangler
  console.log('\nExecuting SQL via wrangler d1...');
  try {
    execSync(`npx wrangler d1 execute blog-comments --file="${sqlFile}"`, {
      stdio: 'inherit',
      cwd: path.dirname(path.dirname(inputFile)) || '.'
    });
    console.log(`\nSuccessfully imported ${comments.length} comments!`);
  } catch (error) {
    console.error('\nError executing SQL. You can try manually:');
    console.error(`  npx wrangler d1 execute blog-comments --file=${sqlFile}`);
    process.exit(1);
  }
}

main();

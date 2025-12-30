#!/usr/bin/env node

/**
 * Disqus to Cloudflare D1 Migration Script
 *
 * Usage:
 *   node scripts/migrate-disqus.js <disqus-export.xml> [output.json]
 *
 * To export from Disqus:
 *   1. Go to https://disqus.com/admin/
 *   2. Select your site
 *   3. Go to Moderation > Export
 *   4. Download the XML file
 */

const fs = require('fs');
const path = require('path');

// Simple XML parser for Disqus export format
function parseDisqusXML(xmlContent) {
  const comments = [];
  const threads = new Map();

  // Extract threads (posts/pages)
  const threadRegex = /<thread[^>]*dsq:id="([^"]*)"[^>]*>[\s\S]*?<link>([^<]*)<\/link>[\s\S]*?<\/thread>/g;
  let match;
  while ((match = threadRegex.exec(xmlContent)) !== null) {
    const [, id, link] = match;
    threads.set(id, link);
  }

  // Extract posts (comments)
  const postRegex = /<post[^>]*dsq:id="([^"]*)"[^>]*>([\s\S]*?)<\/post>/g;
  while ((match = postRegex.exec(xmlContent)) !== null) {
    const [, postId, postContent] = match;

    // Skip deleted or spam comments
    if (/<isDeleted>true<\/isDeleted>/.test(postContent)) continue;
    if (/<isSpam>true<\/isSpam>/.test(postContent)) continue;

    // Extract fields
    const threadId = extractTag(postContent, 'thread', 'dsq:id');
    const message = extractCDATA(postContent, 'message');
    const createdAt = extractTag(postContent, 'createdAt');
    const authorName = extractTag(postContent, 'name');
    const authorEmail = extractTag(postContent, 'email');

    // Get URL from thread
    const url = threads.get(threadId);
    if (!url) continue;

    // Skip empty comments
    if (!message || !message.trim()) continue;

    comments.push({
      url: url,
      name: authorName || 'Anonymous',
      email: authorEmail || null,
      content: cleanMessage(message),
      created_at: createdAt || new Date().toISOString()
    });
  }

  return comments;
}

// Extract tag content
function extractTag(content, tagName, attr = null) {
  if (attr) {
    const regex = new RegExp(`<${tagName}[^>]*${attr}="([^"]*)"`, 'i');
    const match = content.match(regex);
    return match ? match[1] : null;
  }
  const regex = new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

// Extract CDATA content
function extractCDATA(content, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\/${tagName}>`, 'i');
  const match = content.match(regex);
  if (match) return match[1];

  // Fallback to regular tag
  return extractTag(content, tagName);
}

// Clean HTML from message
function cleanMessage(message) {
  return message
    // Remove HTML tags but keep content
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Main
function main() {
  const args = process.argv.slice(2);

  if (args.length < 1) {
    console.log('Usage: node migrate-disqus.js <disqus-export.xml> [output.json]');
    console.log('');
    console.log('To export from Disqus:');
    console.log('  1. Go to https://disqus.com/admin/');
    console.log('  2. Select your site > Moderation > Export');
    console.log('  3. Download the XML file');
    process.exit(1);
  }

  const inputFile = args[0];
  const outputFile = args[1] || inputFile.replace(/\.xml$/i, '.json');

  // Check input file exists
  if (!fs.existsSync(inputFile)) {
    console.error(`Error: File not found: ${inputFile}`);
    process.exit(1);
  }

  console.log(`Reading ${inputFile}...`);
  const xmlContent = fs.readFileSync(inputFile, 'utf-8');

  console.log('Parsing Disqus export...');
  const comments = parseDisqusXML(xmlContent);

  // Sort by date
  comments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Summary by URL
  const urlCounts = {};
  comments.forEach(c => {
    urlCounts[c.url] = (urlCounts[c.url] || 0) + 1;
  });

  console.log(`\nFound ${comments.length} comments across ${Object.keys(urlCounts).length} pages:`);
  Object.entries(urlCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([url, count]) => {
      console.log(`  ${count} comments: ${url}`);
    });
  if (Object.keys(urlCounts).length > 10) {
    console.log(`  ... and ${Object.keys(urlCounts).length - 10} more pages`);
  }

  // Write output
  const output = {
    exported_at: new Date().toISOString(),
    source: 'disqus',
    total_comments: comments.length,
    comments: comments
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
  console.log(`\nWritten to ${outputFile}`);
  console.log(`\nNext steps:`);
  console.log(`  1. Review the JSON file`);
  console.log(`  2. Import to D1: node scripts/import-to-d1.js ${outputFile}`);
}

main();

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **izhengfan-hugo**, a Hugo theme optimized for Chinese-language blogs. It's a standalone theme (not a site with content).

- Minimum Hugo version: 0.41
- Language: Chinese (zh-cmn-Hans)
- License: MIT

## Development Commands

```bash
# Preview the theme (run from a Hugo site using this theme)
hugo server

# Build the site
hugo

# Build with drafts
hugo -D
```

## Architecture

### Template Hierarchy

```
layouts/
├── _default/
│   ├── baseof.html    # Base template - defines page structure
│   ├── single.html    # Individual post template
│   └── list.html      # Taxonomy/archive pages
├── partials/          # Reusable components
│   ├── head.html      # Critical CSS inlined + meta tags
│   ├── header.html    # Navigation with social links
│   ├── footer.html    # Copyright with CC BY-NC-SA 4.0
│   └── disqus.html    # Lazy-loaded comments
├── shortcodes/
│   └── spoiler.html   # Collapsible content via <details>
├── index.html         # Homepage
└── 404.html           # Error page
```

### Data Files

- `data/color.toml` - Post link colors (used via frontmatter `linkcolor`)
- `data/static.toml` - CDN paths and favicon configuration
- `data/verification.toml` - SEO verification tokens (Google, Bing, Yandex, Baidu)

### Static Assets

- `static/css/style.min.css` - Main styles (critical CSS inlined in head.html)
- `static/css/syntax.min.css` - Code syntax highlighting
- `static/icomoon/` - Custom icon font (replaces FontAwesome)

## Required Site Configuration

Sites using this theme must set these parameters in their Hugo config:

```toml
[params]
  description = "Site tagline"
  Copyright = "Author Name"
  CopyrightSince = "2013"
  keywords = ["keyword1", "keyword2"]
  # source_url = "https://github.com/user/repo/edit/main/content/"  # Optional: enables edit links

[params.social]
  GitHub = "https://github.com/username || github"
  # Format: "URL || icon-name" (icon names from icomoon font)

[services.googleAnalytics]
  ID = "UA-XXXXX-X"

[services.disqus]
  shortname = "your-shortname"

[[menus.main]]
  name = "About"
  url = "/about/"
```

## Post Frontmatter Options

```yaml
---
title: "Post Title"
date: 2024-01-01
tags: ["tag1", "tag2"]
toc: true          # Enable/disable table of contents (default: true)
linkcolor: "blue"  # Custom link color from data/color.toml
---
```

## Key Implementation Details

- **TOC Processing**: `single.html` removes nested `<ul>` wrappers from Hugo's TableOfContents for cleaner rendering
- **Critical CSS**: Essential styles are inlined in `head.html`; full stylesheet loaded asynchronously
- **Multilingual Support**: Header shows language switcher when `site.Languages` has multiple entries
- **Social Links**: Parsed from `params.social` map using `||` delimiter for URL and icon name

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
│   ├── comments.html  # Comment system dispatcher
│   ├── disqus.html    # Disqus comments
│   ├── giscus.html    # Giscus comments (GitHub Discussions)
│   └── cloudflare-comments.html  # Cloudflare Workers comments
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

# Comment system configuration (choose one: disqus, giscus, or cloudflare)
[params.comments]
  system = "giscus"  # Options: "disqus", "giscus", "cloudflare", or "" to disable

# Disqus (legacy, still supported)
[services.disqus]
  shortname = "your-shortname"

# Giscus (GitHub Discussions) - recommended
[params.comments.giscus]
  repo = "username/repo"
  repoId = "R_xxx"
  category = "Announcements"
  categoryId = "DIC_xxx"
  mapping = "pathname"        # pathname, url, title, og:title
  reactionsEnabled = "1"
  emitMetadata = "0"
  inputPosition = "top"       # top, bottom
  theme = "light"             # light, dark, preferred_color_scheme
  lang = "zh-CN"

# Cloudflare Workers comments
[params.comments.cloudflare]
  workerUrl = "https://comments.example.workers.dev"
  turnstile = false           # Enable Turnstile captcha
  turnstileSiteKey = ""       # Turnstile site key

[[menus.main]]
  name = "About"
  url = "/about/"
```

### Cloudflare Worker API

If using Cloudflare comments, deploy a Worker with these endpoints:
- `GET /comments?url={pageUrl}` - Returns `{ comments: [...] }`
- `POST /comments` - Body: `{ url, name, email, content, turnstileToken? }`

## Post Frontmatter Options

```yaml
---
title: "Post Title"
date: 2024-01-01
tags: ["tag1", "tag2"]
toc: true          # Enable/disable table of contents (default: true)
linkcolor: "blue"  # Custom link color from data/color.toml
comment: false     # Disable comments for this post (default: true)
---
```

## Key Implementation Details

- **TOC Processing**: `single.html` removes nested `<ul>` wrappers from Hugo's TableOfContents for cleaner rendering
- **Critical CSS**: Essential styles are inlined in `head.html`; full stylesheet loaded asynchronously
- **Multilingual Support**: Header shows language switcher when `site.Languages` has multiple entries
- **Social Links**: Parsed from `params.social` map using `||` delimiter for URL and icon name
- **Comment Systems**: Supports Disqus, Giscus (GitHub Discussions), and Cloudflare Workers. All use lazy-loading (click to load). Dispatcher partials (`comments.html`, `comments-script.html`) route to the correct system based on `params.comments.system`

# Blog Comments Worker

A Cloudflare Worker that provides a comment system API for the izhengfan-hugo theme, using D1 (SQLite) for storage.

## Features

- Lightweight comment storage with Cloudflare D1
- CORS support for cross-origin requests
- Optional Cloudflare Turnstile spam protection
- Simple REST API

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Cloudflare account](https://dash.cloudflare.com/sign-up)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

## Deployment

### 1. Install dependencies

```bash
cd examples/cloudflare-worker
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Create D1 database

```bash
npx wrangler d1 create blog-comments
```

This will output a database ID. Copy it and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "blog-comments"
database_id = "your-database-id-here"  # <-- Replace this
```

### 4. Initialize the database schema

```bash
npx wrangler d1 execute blog-comments --file=schema.sql
```

### 5. Deploy the Worker

```bash
npm run deploy
```

The Worker will be deployed to `https://blog-comments.<your-subdomain>.workers.dev`.

## Configuration

### Allowed Origins (CORS)

By default, all origins are allowed. To restrict to specific domains, set `ALLOWED_ORIGINS` in `wrangler.toml`:

```toml
[vars]
ALLOWED_ORIGINS = "https://yourblog.com,https://www.yourblog.com"
```

### Turnstile Spam Protection (Optional)

1. Create a Turnstile widget at [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/turnstile)
2. Add the secret key as a Wrangler secret:

```bash
npx wrangler secret put TURNSTILE_SECRET
```

3. Update your Hugo config with the site key:

```toml
[params.comments.cloudflare]
  workerUrl = "https://blog-comments.xxx.workers.dev"
  turnstile = true
  turnstileSiteKey = "your-site-key"
```

## Hugo Theme Configuration

Add this to your Hugo site's `config.toml`:

```toml
[params.comments]
  system = "cloudflare"

[params.comments.cloudflare]
  workerUrl = "https://blog-comments.xxx.workers.dev"
  # Optional Turnstile
  turnstile = false
  turnstileSiteKey = ""
```

## API Reference

### GET /comments

Fetch comments for a page.

**Query Parameters:**
- `url` (required): The page URL

**Response:**
```json
{
  "comments": [
    {
      "id": 1,
      "name": "John",
      "content": "Great post!",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST /comments

Submit a new comment.

**Request Body:**
```json
{
  "url": "https://example.com/posts/hello/",
  "name": "John",
  "email": "john@example.com",
  "content": "Great post!",
  "turnstileToken": "optional-if-turnstile-enabled"
}
```

**Response:**
```json
{
  "success": true,
  "id": 1
}
```

## Migrating from Disqus

If you're moving from Disqus, you can migrate your existing comments:

### 1. Export from Disqus

1. Go to [Disqus Admin](https://disqus.com/admin/)
2. Select your site
3. Go to **Moderation** > **Export**
4. Click "Export Comments" and wait for the email
5. Download the XML file

### 2. Convert to JSON

```bash
npm run migrate:disqus -- /path/to/disqus-export.xml
```

This creates a JSON file with all your comments. Review it to make sure everything looks correct.

### 3. Import to D1

```bash
# Dry run first (generates SQL without executing)
npm run migrate:import -- /path/to/disqus-export.json --dry-run

# Actually import
npm run migrate:import -- /path/to/disqus-export.json
```

### URL Mapping

The migration script preserves the original URLs from Disqus. If your blog URL structure has changed, you may need to update the URLs in the JSON file before importing.

## Local Development

```bash
npm run dev
```

This starts a local development server at `http://localhost:8787`.

## Cost

Cloudflare's free tier includes:
- **Workers**: 100,000 requests/day
- **D1**: 5M rows read/day, 100K rows written/day, 5GB storage

This is more than sufficient for most personal blogs.

## License

MIT

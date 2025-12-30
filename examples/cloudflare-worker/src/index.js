import { Hono } from 'hono';
import { cors } from 'hono/cors';

const app = new Hono();

// CORS middleware
app.use('*', async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS
    ? c.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

  const origin = c.req.header('Origin');

  // Allow all origins if ALLOWED_ORIGINS is empty, otherwise check whitelist
  const isAllowed = allowedOrigins.length === 0 ||
    allowedOrigins.includes(origin) ||
    allowedOrigins.includes('*');

  if (isAllowed) {
    c.header('Access-Control-Allow-Origin', origin || '*');
    c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    c.header('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }

  await next();
});

// Verify Turnstile token (optional)
async function verifyTurnstile(token, secret, ip) {
  if (!secret || !token) return true; // Skip if not configured

  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  if (ip) formData.append('remoteip', ip);

  const response = await fetch(
    'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    { method: 'POST', body: formData }
  );

  const result = await response.json();
  return result.success === true;
}

// GET /comments - Fetch comments for a URL
app.get('/comments', async (c) => {
  const url = c.req.query('url');

  if (!url) {
    return c.json({ error: 'Missing url parameter' }, 400);
  }

  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, name, content, created_at FROM comments WHERE url = ? ORDER BY created_at ASC'
    ).bind(url).all();

    return c.json({ comments: results || [] });
  } catch (error) {
    console.error('Database error:', error);
    return c.json({ error: 'Failed to fetch comments' }, 500);
  }
});

// POST /comments - Submit a new comment
app.post('/comments', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { url, name, email, content, turnstileToken } = body;

  // Validate required fields
  if (!url || !name || !content) {
    return c.json({ error: 'Missing required fields: url, name, content' }, 400);
  }

  // Validate content length
  if (name.length > 100) {
    return c.json({ error: 'Name too long (max 100 characters)' }, 400);
  }
  if (content.length > 5000) {
    return c.json({ error: 'Content too long (max 5000 characters)' }, 400);
  }

  // Verify Turnstile if configured
  const turnstileSecret = c.env.TURNSTILE_SECRET;
  if (turnstileSecret) {
    const ip = c.req.header('CF-Connecting-IP');
    const isValid = await verifyTurnstile(turnstileToken, turnstileSecret, ip);
    if (!isValid) {
      return c.json({ error: 'Turnstile verification failed' }, 403);
    }
  }

  try {
    const result = await c.env.DB.prepare(
      'INSERT INTO comments (url, name, email, content) VALUES (?, ?, ?, ?)'
    ).bind(url, name, email || null, content).run();

    return c.json({
      success: true,
      id: result.meta.last_row_id
    }, 201);
  } catch (error) {
    console.error('Database error:', error);
    return c.json({ error: 'Failed to save comment' }, 500);
  }
});

// Health check
app.get('/', (c) => {
  return c.json({ status: 'ok', service: 'blog-comments' });
});

export default app;

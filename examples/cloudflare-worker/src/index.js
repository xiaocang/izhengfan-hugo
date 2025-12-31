import { Hono } from 'hono';

const app = new Hono();

// Compact MD5 implementation for Gravatar compatibility
function md5(str) {
  const k = [], s = [];
  for (let i = 0; i < 64; i++) {
    k[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);
    s[i] = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21][((i / 16) | 0) * 4 + (i % 4)];
  }
  const input = unescape(encodeURIComponent(str));
  const bytes = [];
  for (let i = 0; i < input.length; i++) bytes.push(input.charCodeAt(i));
  bytes.push(0x80);
  while ((bytes.length % 64) !== 56) bytes.push(0);
  const bits = input.length * 8;
  for (let i = 0; i < 8; i++) bytes.push((bits / Math.pow(2, 8 * i)) & 0xff);

  let [a0, b0, c0, d0] = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476];
  for (let i = 0; i < bytes.length; i += 64) {
    const m = [];
    for (let j = 0; j < 16; j++) {
      m[j] = bytes[i + j * 4] | (bytes[i + j * 4 + 1] << 8) | (bytes[i + j * 4 + 2] << 16) | (bytes[i + j * 4 + 3] << 24);
    }
    let [a, b, c, d] = [a0, b0, c0, d0];
    for (let j = 0; j < 64; j++) {
      let f, g;
      if (j < 16) { f = (b & c) | (~b & d); g = j; }
      else if (j < 32) { f = (d & b) | (~d & c); g = (5 * j + 1) % 16; }
      else if (j < 48) { f = b ^ c ^ d; g = (3 * j + 5) % 16; }
      else { f = c ^ (b | ~d); g = (7 * j) % 16; }
      const temp = d; d = c; c = b;
      const sum = (a + f + k[j] + m[g]) >>> 0;
      b = (b + ((sum << s[j]) | (sum >>> (32 - s[j])))) >>> 0;
      a = temp;
    }
    a0 = (a0 + a) >>> 0; b0 = (b0 + b) >>> 0; c0 = (c0 + c) >>> 0; d0 = (d0 + d) >>> 0;
  }
  return [a0, b0, c0, d0].map(n =>
    [0, 8, 16, 24].map(i => ((n >>> i) & 0xff).toString(16).padStart(2, '0')).join('')
  ).join('');
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function buildEmailHash(email) {
  if (!email) return null;
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return md5(normalized);
}

function buildCommentAvatarHash(commentId, email) {
  const emailHash = buildEmailHash(email);
  if (emailHash) return emailHash;
  return md5(`comment:${commentId}`);
}

function normalizeAvatarBase(base) {
  if (!base) return '';
  return base.endsWith('/') ? base : `${base}/`;
}

function pickSearchParam(params, name, pattern) {
  const value = params.get(name);
  if (!value) return null;
  if (pattern && !pattern.test(value)) return null;
  return value;
}

function buildAvatarRequestUrl(base, hash, requestUrl) {
  const avatarUrl = new URL(`${base}${hash}`);
  const query = new URL(requestUrl).searchParams;
  const size = pickSearchParam(query, 's', /^\d+$/);
  const fallback = pickSearchParam(query, 'd');
  const rating = pickSearchParam(query, 'r');

  if (size) avatarUrl.searchParams.set('s', size);
  if (fallback) avatarUrl.searchParams.set('d', fallback);
  if (rating) avatarUrl.searchParams.set('r', rating);

  return avatarUrl;
}

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

// GET /avatar/by-id/:id - Proxy avatar based on comment id
app.get('/avatar/by-id/:id', async (c) => {
  const rawId = c.req.param('id') || '';
  const commentId = Number.parseInt(rawId, 10);
  if (!Number.isFinite(commentId) || commentId <= 0) {
    return c.text('Invalid comment id', 400);
  }

  const base = normalizeAvatarBase(c.env.AVATAR_BASE || 'https://www.gravatar.com/avatar/');
  if (!base) {
    return c.text('Avatar base not configured', 500);
  }

  try {
    const { results } = await c.env.DB.prepare(
      'SELECT email FROM comments WHERE id = ?'
    ).bind(commentId).all();

    const row = results && results[0];
    if (!row) {
      return c.text('Comment not found', 404);
    }

    const hash = buildCommentAvatarHash(commentId, row.email);
    const avatarUrl = buildAvatarRequestUrl(base, hash, c.req.url);

    const upstream = await fetch(avatarUrl.toString(), {
      cf: {
        cacheTtl: 86400,
        cacheEverything: true
      }
    });

    const headers = new Headers(upstream.headers);
    headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');

    return new Response(upstream.body, {
      status: upstream.status,
      headers
    });
  } catch (error) {
    console.error('Database error:', error);
    return c.text('Failed to fetch avatar', 500);
  }
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

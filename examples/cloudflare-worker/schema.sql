-- Blog comments table
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster lookups by URL
CREATE INDEX IF NOT EXISTS idx_comments_url ON comments(url);

-- Index for sorting by date
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);

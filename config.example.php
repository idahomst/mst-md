<?php
// mst·md configuration — copy to config.php (which is git-ignored) and edit.

// Sign-in name
define('USERNAME', 'admin');

// Password hash. Generate one with:
//     php -r "echo password_hash('your-password', PASSWORD_DEFAULT), PHP_EOL;"
define('PASSWORD', '$2y$12$replace.this.with.your.own.hash.................');

// --- Optional -----------------------------------------------------------
// Where notes are stored. Best outside the web root, e.g. '/srv/mst-md/notes'.
// define('NOTES_DIR', __DIR__ . '/notes');

// Where runtime data (login throttling) is stored.
// define('DATA_DIR', __DIR__ . '/data');

// Sign out after this many seconds without activity (default: 7 days).
// define('SESSION_IDLE_SECONDS', 604800);

// Failed sign-ins allowed per IP within the window (default: 5 per 15 min).
// define('LOGIN_MAX_ATTEMPTS', 5);
// define('LOGIN_WINDOW_SECONDS', 900);

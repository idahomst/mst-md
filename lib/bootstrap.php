<?php
/**
 * Shared bootstrap: configuration, hardened session, security headers,
 * authentication and CSRF helpers. Included by index.php and api.php.
 */
declare(strict_types=1);

if (PHP_VERSION_ID < 80100) {
    http_response_code(500);
    exit('mst-md requires PHP 8.1 or newer.');
}

$missing = array_filter(['mbstring', 'session', 'json'], fn($e) => !extension_loaded($e));
if ($missing) {
    http_response_code(500);
    $msg = 'mst-md needs the PHP extension(s): ' . implode(', ', $missing)
         . '. Install them (e.g. apt install php' . PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION . '-mbstring) and restart PHP-FPM.';
    if (str_ends_with($_SERVER['SCRIPT_NAME'] ?? '', 'api.php')) {
        header('Content-Type: application/json');
        exit(json_encode(['error' => $msg]));
    }
    exit($msg);
}

const APP_ROOT = __DIR__ . '/..';
const APP_VERSION = '2.0.0';

$configFile = APP_ROOT . '/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    exit('Missing config.php — copy config.example.php to config.php and set your credentials.');
}
require_once $configFile;

if (!defined('USERNAME') || !defined('PASSWORD')) {
    http_response_code(500);
    exit('config.php must define USERNAME and PASSWORD.');
}

/** Optional settings with defaults (older config.php files keep working). */
function cfg(string $name, mixed $default): mixed
{
    return defined($name) ? constant($name) : $default;
}

define('NOTES_PATH', rtrim((string) cfg('NOTES_DIR', APP_ROOT . '/notes'), '/'));
define('DATA_PATH', rtrim((string) cfg('DATA_DIR', APP_ROOT . '/data'), '/'));
define('SESSION_IDLE_SECONDS', (int) cfg('SESSION_IDLE_SECONDS', 60 * 60 * 24 * 7));
define('LOGIN_MAX_ATTEMPTS', (int) cfg('LOGIN_MAX_ATTEMPTS', 5));
define('LOGIN_WINDOW_SECONDS', (int) cfg('LOGIN_WINDOW_SECONDS', 15 * 60));

require_once __DIR__ . '/Notes.php';
require_once __DIR__ . '/RateLimiter.php';

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

function is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function start_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string) SESSION_IDLE_SECONDS);
    session_name(is_https() ? '__Host-mstmd' : 'mstmd');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_start();

    // Idle timeout
    $now = time();
    if (isset($_SESSION['last_seen']) && $now - (int) $_SESSION['last_seen'] > SESSION_IDLE_SECONDS) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['last_seen'] = $now;
}

/* ------------------------------------------------------------------ */
/* Security headers                                                    */
/* ------------------------------------------------------------------ */

function csp_nonce(): string
{
    static $nonce = null;
    return $nonce ??= base64_encode(random_bytes(16));
}

function send_security_headers(bool $html = true): void
{
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: no-referrer');
    header('X-Frame-Options: DENY');
    header('Cross-Origin-Opener-Policy: same-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
    header('Cache-Control: no-store');
    if ($html) {
        $nonce = csp_nonce();
        header("Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-$nonce'; "
            . "style-src 'self'; img-src 'self' data: https:; connect-src 'self'; "
            . "object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    } else {
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    }
}

/* ------------------------------------------------------------------ */
/* Auth + CSRF                                                         */
/* ------------------------------------------------------------------ */

function is_logged_in(): bool
{
    return ($_SESSION['logged_in'] ?? false) === true;
}

function check_credentials(string $user, string $password): bool
{
    // Always run password_verify so timing doesn't reveal a valid username.
    $passOk = password_verify($password, PASSWORD);
    return hash_equals(USERNAME, $user) && $passOk;
}

function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_valid(?string $token): bool
{
    return is_string($token) && !empty($_SESSION['csrf_token'])
        && hash_equals($_SESSION['csrf_token'], $token);
}

function client_ip(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function h(string $s): string
{
    return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Cache-busting URL for a static asset. */
function asset(string $path): string
{
    $file = APP_ROOT . '/' . $path;
    $v = is_file($file) ? substr(md5((string) filemtime($file)), 0, 8) : APP_VERSION;
    return h($path . '?v=' . $v);
}

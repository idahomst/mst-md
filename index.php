<?php
/**
 * Entry point: sign-in, sign-out and the application shell.
 */
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

start_session();
send_security_headers();

$method = $_SERVER['REQUEST_METHOD'];
$action = $_POST['action'] ?? '';

// --- Sign out (POST + CSRF, so a link elsewhere can't log you out) ---------
if ($method === 'POST' && $action === 'logout') {
    if (csrf_valid($_POST['csrf'] ?? null)) {
        $_SESSION = [];
        session_regenerate_id(true);
        session_destroy();
    }
    header('Location: ./', true, 303);
    exit;
}

// --- Sign in -----------------------------------------------------------------
$error = null;
if (!is_logged_in()) {
    $limiter = new RateLimiter(DATA_PATH, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_SECONDS);

    if ($method === 'POST' && $action === 'login') {
        $wait = $limiter->retryAfter(client_ip());
        if ($wait > 0) {
            http_response_code(429);
            header('Retry-After: ' . $wait);
            $error = sprintf('Too many attempts. Try again in %d minute(s).', (int) ceil($wait / 60));
        } elseif (!csrf_valid($_POST['csrf'] ?? null)) {
            $error = 'The form expired — please try again.';
        } elseif (check_credentials((string) ($_POST['username'] ?? ''), (string) ($_POST['password'] ?? ''))) {
            $limiter->clear(client_ip());
            session_regenerate_id(true);
            $_SESSION = ['logged_in' => true, 'last_seen' => time()];
            unset($_SESSION['csrf_token']);
            header('Location: ./', true, 303);
            exit;
        } else {
            $limiter->fail(client_ip());
            usleep(random_int(200_000, 400_000));
            http_response_code(401);
            $error = 'Wrong username or password.';
        }
    }

    $csrf = csrf_token();
    require __DIR__ . '/views/login.php';
    exit;
}

// --- App ---------------------------------------------------------------------
$csrf = csrf_token();
require __DIR__ . '/views/app.php';

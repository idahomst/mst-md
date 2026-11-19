<?php
/**
 * JSON API.
 *   GET  api.php?action=tree
 *   GET  api.php?action=read&path=…
 *   GET  api.php?action=search&q=…
 *   POST api.php?action=save          {path, content, version?, force?}
 *   POST api.php?action=createNote    {folder, name}
 *   POST api.php?action=createFolder  {parent, name}
 *   POST api.php?action=move          {from, to}
 *   POST api.php?action=delete        {path}
 * Every POST needs the X-CSRF-Token header.
 */
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

start_session();
send_security_headers(html: false);
header('Content-Type: application/json; charset=utf-8');

function respond(array $data, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function body(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        respond(['error' => 'Request body must be JSON'], 400);
    }
    return $data;
}

function str(array $src, string $key, string $default = ''): string
{
    $v = $src[$key] ?? $default;
    if (!is_string($v)) {
        respond(['error' => "Field '$key' must be a string"], 422);
    }
    return $v;
}

if (!is_logged_in()) {
    respond(['error' => 'Your session has expired — please sign in again'], 401);
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$reads  = ['tree', 'read', 'search'];
$writes = ['save', 'createNote', 'createFolder', 'move', 'delete'];

if (in_array($action, $reads, true) && $method !== 'GET'
    || in_array($action, $writes, true) && $method !== 'POST') {
    header('Allow: ' . (in_array($action, $reads, true) ? 'GET' : 'POST'));
    respond(['error' => 'Method not allowed'], 405);
}
if ($method === 'POST' && !csrf_valid($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) {
    respond(['error' => 'Security token expired — reload the page'], 403);
}
// The session is only needed for auth/CSRF; release the lock so parallel
// requests (e.g. search while saving) are not serialised.
session_write_close();

try {
    $notes = new Notes(NOTES_PATH);

    $result = match ($action) {
        'tree'   => ['tree' => $notes->tree()],
        'read'   => $notes->read(str($_GET, 'path')),
        'search' => ['results' => $notes->search(str($_GET, 'q'))],

        'save' => (function () use ($notes) {
            $b = body();
            $base = $b['version'] ?? null;
            return $notes->save(str($b, 'path'), str($b, 'content'), is_string($base) ? $base : null, ($b['force'] ?? false) === true);
        })(),
        'createNote' => (function () use ($notes) {
            $b = body();
            return $notes->createNote(str($b, 'folder'), str($b, 'name'));
        })(),
        'createFolder' => (function () use ($notes) {
            $b = body();
            return $notes->createFolder(str($b, 'parent'), str($b, 'name'));
        })(),
        'move' => (function () use ($notes) {
            $b = body();
            return $notes->move(str($b, 'from'), str($b, 'to'));
        })(),
        'delete' => (function () use ($notes) {
            $notes->delete(str(body(), 'path'));
            return [];
        })(),

        default => respond(['error' => 'Unknown action'], 404),
    };

    respond(['ok' => true] + $result);
} catch (NotesError $e) {
    respond(['error' => $e->getMessage()] + $e->extra, $e->status);
} catch (Throwable $e) {
    error_log('mst-md: ' . $e);
    // Only the signed-in owner can reach this point, so show the real cause.
    respond(['error' => 'Server error: ' . $e->getMessage() . ' (' . basename($e->getFile()) . ':' . $e->getLine() . ')'], 500);
}

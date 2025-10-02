<?php
session_start();

// Check authentication
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    header('Content-Type: application/json');
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// CSRF check for POST requests
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_SERVER['HTTP_X_CSRF_TOKEN']) || !isset($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $_SERVER['HTTP_X_CSRF_TOKEN'])) {
        header('Content-Type: application/json');
        http_response_code(403);
        echo json_encode(['error' => 'Invalid CSRF token']);
        exit;
    }
}

define('NOTES_DIR', __DIR__ . '/notes');

header('Content-Type: application/json');

$action = $_GET['action'] ?? '';

// Helper function to sanitize paths
function sanitizePath($path) {
    $path = str_replace(['..', "\0"], '', $path);
    $path = trim($path, '/');
    return $path;
}

// Helper function to get full path
function getFullPath($relativePath) {
    $safePath = sanitizePath($relativePath);
    return NOTES_DIR . '/' . $safePath;
}

// Helper function to check if path is within notes directory
function isPathSafe($fullPath) {
    $realNotesDir = realpath(NOTES_DIR);
    $realPath = realpath($fullPath);

    if ($realPath === false) {
        // Path doesn't exist yet, check parent
        $realPath = realpath(dirname($fullPath));
        if ($realPath === false) {
            return false;
        }
    }

    return strpos($realPath, $realNotesDir) === 0;
}

// Recursive function to build file tree
function buildFileTree($dir, $basePath = '') {
    $tree = [];

    if (!is_dir($dir)) {
        return $tree;
    }

    $items = scandir($dir);

    foreach ($items as $item) {
        if ($item === '.' || $item === '..') {
            continue;
        }

        $fullPath = $dir . '/' . $item;
        $relativePath = $basePath ? $basePath . '/' . $item : $item;

        if (is_dir($fullPath)) {
            $tree[] = [
                'name' => $item,
                'type' => 'folder',
                'path' => $relativePath,
                'children' => buildFileTree($fullPath, $relativePath)
            ];
        } elseif (pathinfo($item, PATHINFO_EXTENSION) === 'md') {
            $tree[] = [
                'name' => $item,
                'type' => 'file',
                'path' => $relativePath,
                'modified' => filemtime($fullPath)
            ];
        }
    }

    // Sort: folders first, then files, alphabetically
    usort($tree, function($a, $b) {
        if ($a['type'] !== $b['type']) {
            return $a['type'] === 'folder' ? -1 : 1;
        }
        return strcasecmp($a['name'], $b['name']);
    });

    return $tree;
}

try {
    // Ensure notes directory exists
    if (!file_exists(NOTES_DIR)) {
        mkdir(NOTES_DIR, 0755, true);
    }

    switch ($action) {
        case 'getTree':
            $tree = buildFileTree(NOTES_DIR);
            echo json_encode(['success' => true, 'tree' => $tree]);
            break;

        case 'getFile':
            $path = $_GET['path'] ?? '';
            $fullPath = getFullPath($path);

            if (!isPathSafe($fullPath) || !file_exists($fullPath) || !is_file($fullPath)) {
                throw new Exception('Invalid file path');
            }

            $content = file_get_contents($fullPath);
            echo json_encode([
                'success' => true,
                'content' => $content,
                'path' => $path,
                'name' => basename($path)
            ]);
            break;

        case 'saveFile':
            $data = json_decode(file_get_contents('php://input'), true);
            $path = $data['path'] ?? '';
            $content = $data['content'] ?? '';

            $fullPath = getFullPath($path);

            if (!isPathSafe($fullPath)) {
                throw new Exception('Invalid file path');
            }

            // Create directory if it doesn't exist
            $dir = dirname($fullPath);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            file_put_contents($fullPath, $content);
            echo json_encode([
                'success' => true,
                'message' => 'File saved',
                'modified' => filemtime($fullPath)
            ]);
            break;

        case 'createFile':
            $data = json_decode(file_get_contents('php://input'), true);
            $path = $data['path'] ?? '';
            $name = $data['name'] ?? 'untitled.md';

            // Ensure .md extension
            if (pathinfo($name, PATHINFO_EXTENSION) !== 'md') {
                $name .= '.md';
            }

            $fullPath = getFullPath($path ? $path . '/' . $name : $name);

            if (!isPathSafe($fullPath)) {
                throw new Exception('Invalid file path');
            }

            if (file_exists($fullPath)) {
                throw new Exception('File already exists');
            }

            // Create directory if needed
            $dir = dirname($fullPath);
            if (!is_dir($dir)) {
                mkdir($dir, 0755, true);
            }

            file_put_contents($fullPath, "# " . pathinfo($name, PATHINFO_FILENAME) . "\n\n");
            echo json_encode([
                'success' => true,
                'message' => 'File created',
                'path' => $path ? $path . '/' . $name : $name
            ]);
            break;

        case 'createFolder':
            $data = json_decode(file_get_contents('php://input'), true);
            $path = $data['path'] ?? '';
            $name = $data['name'] ?? 'New Folder';

            $fullPath = getFullPath($path ? $path . '/' . $name : $name);

            if (!isPathSafe($fullPath)) {
                throw new Exception('Invalid folder path');
            }

            if (file_exists($fullPath)) {
                throw new Exception('Folder already exists');
            }

            mkdir($fullPath, 0755, true);
            echo json_encode([
                'success' => true,
                'message' => 'Folder created',
                'path' => $path ? $path . '/' . $name : $name
            ]);
            break;

        case 'delete':
            $data = json_decode(file_get_contents('php://input'), true);
            $path = $data['path'] ?? '';

            $fullPath = getFullPath($path);

            if (!isPathSafe($fullPath) || !file_exists($fullPath)) {
                throw new Exception('Invalid path');
            }

            if (is_dir($fullPath)) {
                // Recursive delete
                $it = new RecursiveDirectoryIterator($fullPath, RecursiveDirectoryIterator::SKIP_DOTS);
                $files = new RecursiveIteratorIterator($it, RecursiveIteratorIterator::CHILD_FIRST);
                foreach($files as $file) {
                    if ($file->isDir()){
                        rmdir($file->getRealPath());
                    } else {
                        unlink($file->getRealPath());
                    }
                }
                rmdir($fullPath);
            } else {
                unlink($fullPath);
            }

            echo json_encode(['success' => true, 'message' => 'Deleted successfully']);
            break;

        case 'rename':
            $data = json_decode(file_get_contents('php://input'), true);
            $oldPath = $data['oldPath'] ?? '';
            $newName = $data['newName'] ?? '';

            $oldFullPath = getFullPath($oldPath);
            $newFullPath = getFullPath(dirname($oldPath) . '/' . $newName);

            if (!isPathSafe($oldFullPath) || !isPathSafe($newFullPath)) {
                throw new Exception('Invalid path');
            }

            if (!file_exists($oldFullPath)) {
                throw new Exception('File not found');
            }

            if (file_exists($newFullPath)) {
                throw new Exception('Target already exists');
            }

            rename($oldFullPath, $newFullPath);
            echo json_encode([
                'success' => true,
                'message' => 'Renamed successfully',
                'newPath' => dirname($oldPath) . '/' . $newName
            ]);
            break;

        case 'search':
            $query = $_GET['query'] ?? '';
            $results = [];

            if (strlen($query) < 2) {
                echo json_encode(['success' => true, 'results' => []]);
                break;
            }

            // Check if notes directory exists and has content
            if (!is_dir(NOTES_DIR) || !file_exists(NOTES_DIR)) {
                echo json_encode(['success' => true, 'results' => []]);
                break;
            }

            try {
                $iterator = new RecursiveIteratorIterator(
                    new RecursiveDirectoryIterator(NOTES_DIR, RecursiveDirectoryIterator::SKIP_DOTS),
                    RecursiveIteratorIterator::LEAVES_ONLY
                );

                foreach ($iterator as $file) {
                    if ($file->isFile() && strtolower($file->getExtension()) === 'md') {
                        $content = file_get_contents($file->getPathname());
                        $relativePath = str_replace(NOTES_DIR . DIRECTORY_SEPARATOR, '', $file->getPathname());

                        // Search in filename and content
                        if (stripos($file->getFilename(), $query) !== false || stripos($content, $query) !== false) {
                            // Get context around match
                            $lines = explode("\n", $content);
                            $matchedLines = [];

                            foreach ($lines as $lineNum => $line) {
                                if (stripos($line, $query) !== false) {
                                    $matchedLines[] = [
                                        'line' => $lineNum + 1,
                                        'text' => mb_substr($line, 0, 100)
                                    ];
                                    if (count($matchedLines) >= 3) break;
                                }
                            }

                            $results[] = [
                                'path' => $relativePath,
                                'name' => $file->getFilename(),
                                'matches' => $matchedLines
                            ];
                        }
                    }
                }
            } catch (Exception $e) {
                // If there's an error iterating, just return empty results
                error_log($e->getMessage());
                echo json_encode(['success' => true, 'results' => []]);
                break;
            }

            echo json_encode(['success' => true, 'results' => $results]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['error' => $e->getMessage()]);
}

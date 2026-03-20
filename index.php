<?php
session_start();

// Include configuration
require_once 'config.php';

define('NOTES_DIR', __DIR__ . '/notes');

// Create notes directory if it doesn't exist
if (!file_exists(NOTES_DIR)) {
    mkdir(NOTES_DIR, 0755, true);
}

// Brute-force protection
if (!isset($_SESSION['login_attempts'])) {
    $_SESSION['login_attempts'] = 0;
}

// Check if user is logged in
if (!isset($_SESSION['logged_in']) || $_SESSION['logged_in'] !== true) {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['username']) && isset($_POST['password'])) {
        if ($_SESSION['login_attempts'] >= 5) {
            $error = 'Too many login attempts. Please try again later.';
        } elseif ($_POST['username'] === USERNAME && password_verify($_POST['password'], PASSWORD)) {
            $_SESSION['login_attempts'] = 0;
            $_SESSION['logged_in'] = true;
            session_regenerate_id(true); // Prevent session fixation
            header('Location: index.php');
            exit;
        } else {
            $_SESSION['login_attempts']++;
            $error = 'Invalid credentials';
        }
    }

    // Show login form
    include 'login.html';
    exit;
}

// Logout
if (isset($_GET['logout'])) {
    session_destroy();
    header('Location: index.php');
    exit;
}

// CSRF token generation
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="csrf-token" content="<?php echo $_SESSION['csrf_token']; ?>">
    <title>Knowledge Base - Markdown Editor</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/<?php echo HIGHLIGHT_JS_VERSION; ?>/styles/github.min.css" id="highlight-light">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/<?php echo HIGHLIGHT_JS_VERSION; ?>/styles/github-dark.min.css" id="highlight-dark" disabled>
</head>
<body>
    <div class="app-container">
        <!-- Header -->
        <header class="header">
            <div class="header-left">
                <div class="logo">
                    <i data-lucide="book-marked"></i>
                    <h1>Knowledge Base</h1>
                </div>
            </div>
            <div class="header-right">
                <div class="search-container">
                    <i data-lucide="search" class="search-icon"></i>
                    <input type="text" id="searchInput" placeholder="Search notes..." class="search-input">
                </div>
                <button id="previewToggle" class="icon-btn mobile-only" title="Edit mode">
                    <i data-lucide="pen-line"></i>
                </button>
                <button id="desktopModeToggle" class="icon-btn desktop-only" title="Toggle edit mode">
                    <i data-lucide="pen-line"></i>
                </button>
                <button id="themeToggle" class="icon-btn" title="Toggle theme">
                    <i data-lucide="moon"></i>
                </button>
                <button id="layoutToggle" class="icon-btn desktop-only" title="Toggle layout">
                    <i data-lucide="columns-2"></i>
                </button>
                <button id="newFileBtn" class="icon-btn" title="New file">
                    <i data-lucide="file-plus-2"></i>
                </button>
                <button id="newFolderBtn" class="icon-btn" title="New folder">
                    <i data-lucide="folder-plus"></i>
                </button>
                <a href="?logout=1" class="icon-btn" title="Logout">
                    <i data-lucide="log-out"></i>
                </a>
            </div>
        </header>

        <!-- Main content -->
        <div class="main-content">
            <!-- File tree sidebar -->
            <aside class="sidebar">
                <div class="sidebar-header">
                    <h3>Files</h3>
                    <div class="sidebar-actions">
                        <!-- Actions could go here -->
                    </div>
                </div>
                <div id="fileTree" class="file-tree"></div>
            </aside>

            <!-- Editor and preview panels -->
            <div class="editor-container" id="editorContainer">
                <div class="panel editor-panel">
                    <div class="panel-header">
                        <div class="panel-header-left">
                            <i data-lucide="file-text"></i>
                            <span id="currentFileName">No file selected</span>
                        </div>
                        <span id="saveStatus" class="save-status"></span>
                    </div>
                    <textarea id="editor" spellcheck="false" placeholder="Select a file to start editing..."></textarea>
                </div>

                <div class="divider" id="divider"></div>

                <div class="panel preview-panel">
                    <div class="panel-header">
                        <div class="panel-header-left">
                            <i data-lucide="eye"></i>
                            <span>Preview</span>
                        </div>
                    </div>
                    <div id="preview" class="markdown-preview"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- Mobile sidebar toggle button -->
    <button id="mobileSidebarToggle" class="mobile-sidebar-toggle" title="Toggle file tree">
        <i data-lucide="menu"></i>
    </button>

    <!-- Mobile backdrop -->
    <div id="mobileBackdrop" class="mobile-backdrop"></div>

    <!-- Modal for creating new files/folders -->
    <div id="modal" class="modal">
        <div class="modal-content">
            <h3 id="modalTitle">Create New</h3>
            <input type="text" id="modalInput" placeholder="Enter name...">
            <div class="modal-buttons">
                <button id="modalConfirm" class="btn btn-primary">Create</button>
                <button id="modalCancel" class="btn">Cancel</button>
            </div>
        </div>
    </div>

    <script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/marked@<?php echo MARKED_VERSION; ?>/lib/marked.umd.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/<?php echo HIGHLIGHT_JS_VERSION; ?>/highlight.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/<?php echo HIGHLIGHT_JS_VERSION; ?>/languages/python.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/<?php echo HIGHLIGHT_JS_VERSION; ?>/languages/bash.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/<?php echo HIGHLIGHT_JS_VERSION; ?>/languages/yaml.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/<?php echo HIGHLIGHT_JS_VERSION; ?>/languages/json.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/<?php echo HIGHLIGHT_JS_VERSION; ?>/languages/javascript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/<?php echo HIGHLIGHT_JS_VERSION; ?>/languages/php.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/<?php echo HIGHLIGHT_JS_VERSION; ?>/languages/sql.min.js"></script>
    <script src="app.js"></script>
</body>
</html>

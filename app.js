const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

// State management
const state = {
    currentFile: null,
    currentContent: '',
    fileTree: [],
    isDirty: false,
    theme: localStorage.getItem('theme') || 'light',
    layout: localStorage.getItem('layout') || 'horizontal',
    desktopMode: localStorage.getItem('desktopMode') || 'preview', // 'preview' or 'edit'
    expandedFolders: new Set(JSON.parse(localStorage.getItem('expandedFolders') || '[]'))
};

// DOM elements
const editor = document.getElementById('editor');
const preview = document.getElementById('preview');
const fileTree = document.getElementById('fileTree');
const currentFileName = document.getElementById('currentFileName');
const saveStatus = document.getElementById('saveStatus');
const searchInput = document.getElementById('searchInput');
const themeToggle = document.getElementById('themeToggle');
const layoutToggle = document.getElementById('layoutToggle');
const previewToggle = document.getElementById('previewToggle');
const desktopModeToggle = document.getElementById('desktopModeToggle');
const newFileBtn = document.getElementById('newFileBtn');
const newFolderBtn = document.getElementById('newFolderBtn');
const modal = document.getElementById('modal');
const modalTitle = document.getElementById('modalTitle');
const modalInput = document.getElementById('modalInput');
const modalConfirm = document.getElementById('modalConfirm');
const modalCancel = document.getElementById('modalCancel');
const editorContainer = document.getElementById('editorContainer');
const divider = document.getElementById('divider');
const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
const mobileBackdrop = document.getElementById('mobileBackdrop');
const sidebar = document.querySelector('.sidebar');
const previewPanel = document.querySelector('.preview-panel');

// Configure marked with highlight.js
marked.setOptions({
    highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
            try {
                return hljs.highlight(code, { language: lang }).value;
            } catch (err) {}
        }
        return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true
});

// Initialize
init();

function init() {
    applyTheme();
    applyLayout();
    applyDesktopMode();
    loadFileTree();
    setupEventListeners();
}

// Theme management
function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    themeToggle.textContent = state.theme === 'dark' ? '☀️' : '🌙';

    // Toggle highlight.js themes
    document.getElementById('highlight-light').disabled = state.theme === 'dark';
    document.getElementById('highlight-dark').disabled = state.theme === 'light';
}

function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', state.theme);
    applyTheme();
}

// Layout management
function applyLayout() {
    if (state.layout === 'vertical') {
        editorContainer.classList.add('vertical');
    } else {
        editorContainer.classList.remove('vertical');
    }
}

function toggleLayout() {
    state.layout = state.layout === 'horizontal' ? 'vertical' : 'horizontal';
    localStorage.setItem('layout', state.layout);
    applyLayout();
}

// Desktop mode management
function applyDesktopMode() {
    if (state.desktopMode === 'preview') {
        editorContainer.classList.add('preview-only');
    } else {
        editorContainer.classList.remove('preview-only');
    }
    updateDesktopModeButton();
}

function toggleDesktopMode() {
    state.desktopMode = state.desktopMode === 'preview' ? 'edit' : 'preview';
    localStorage.setItem('desktopMode', state.desktopMode);
    applyDesktopMode();
}

function updateDesktopModeButton() {
    if (desktopModeToggle) {
        desktopModeToggle.textContent = state.desktopMode === 'preview' ? '✏️' : '👁️';
        desktopModeToggle.title = state.desktopMode === 'preview' ? 'Edit mode' : 'Preview only mode';
    }
}

// Centralized API fetch function for POST requests
async function apiFetch(url, options = {}) {
    options.method = 'POST';
    options.headers = {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
        ...options.headers,
    };

    try {
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('API Fetch Error:', error);
        alert(`An error occurred: ${error.message}`);
        throw error;
    }
}

// File tree management
async function loadFileTree() {
    try {
        const response = await fetch('api.php?action=getTree');
        const data = await response.json();

        if (data.success) {
            state.fileTree = data.tree;
            renderFileTree();
        }
    } catch (error) {
        console.error('Error loading file tree:', error);
        alert('Error loading file tree');
    }
}

function renderFileTree() {
    fileTree.innerHTML = '';
    renderTreeItems(state.fileTree, fileTree);
}

function renderTreeItems(items, container, level = 0) {
    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'tree-item-wrapper';

        const itemContent = document.createElement('div');
        itemContent.className = 'tree-item';
        itemContent.style.paddingLeft = (level * 8 + 12) + 'px';

        if (item.type === 'folder') {
            const toggle = document.createElement('span');
            toggle.className = 'tree-toggle';
            toggle.textContent = '▶';
            itemContent.appendChild(toggle);

            const icon = document.createElement('span');
            icon.className = 'tree-item-icon';
            icon.textContent = '📁';
            itemContent.appendChild(icon);
        } else {
            const spacer = document.createElement('span');
            spacer.style.width = '10px';
            spacer.style.display = 'inline-block';
            itemContent.appendChild(spacer);

            const icon = document.createElement('span');
            icon.className = 'tree-item-icon';
            icon.textContent = '📄';
            itemContent.appendChild(icon);
        }

        const name = document.createElement('span');
        name.className = 'tree-item-name';
        name.textContent = item.name;
        itemContent.appendChild(name);

        const actions = document.createElement('span');
        actions.className = 'tree-item-actions';

        // Add file button for folders
        if (item.type === 'folder') {
            const addFileBtn = document.createElement('button');
            addFileBtn.className = 'tree-action-btn';
            addFileBtn.textContent = '📄';
            addFileBtn.title = 'New file in this folder';
            addFileBtn.onclick = (e) => {
                e.stopPropagation();
                createNewFileInFolder(item.path);
            };
            actions.appendChild(addFileBtn);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'tree-action-btn';
        deleteBtn.textContent = '🗑️';
        deleteBtn.title = 'Delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Delete ${item.name}?`)) {
                deleteItem(item.path);
            }
        };
        actions.appendChild(deleteBtn);

        itemContent.appendChild(actions);

        if (item.type === 'file') {
            itemContent.onclick = () => {
                loadFile(item.path);
                // Close mobile sidebar when file is selected
                closeMobileSidebar();
            };
            if (state.currentFile === item.path) {
                itemContent.classList.add('active');
            }
        } else {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';

            // Check if folder should be expanded
            const isExpanded = state.expandedFolders.has(item.path);
            childrenContainer.style.display = isExpanded ? 'block' : 'none';

            itemContent.onclick = () => {
                const toggle = itemContent.querySelector('.tree-toggle');
                if (childrenContainer.style.display === 'none') {
                    childrenContainer.style.display = 'block';
                    toggle.classList.add('expanded');
                    state.expandedFolders.add(item.path);
                } else {
                    childrenContainer.style.display = 'none';
                    toggle.classList.remove('expanded');
                    state.expandedFolders.delete(item.path);
                }
                // Save expanded state
                localStorage.setItem('expandedFolders', JSON.stringify([...state.expandedFolders]));
            };

            // Set initial toggle state
            const toggle = itemContent.querySelector('.tree-toggle');
            if (isExpanded) {
                toggle.classList.add('expanded');
            }

            if (item.children && item.children.length > 0) {
                renderTreeItems(item.children, childrenContainer, level + 1);
            }

            itemEl.appendChild(itemContent);
            itemEl.appendChild(childrenContainer);
            container.appendChild(itemEl);
            return;
        }

        itemEl.appendChild(itemContent);
        container.appendChild(itemEl);
    });
}

// File operations
async function loadFile(path) {
    if (state.isDirty && !confirm('You have unsaved changes. Load new file?')) {
        return;
    }

    try {
        const response = await fetch(`api.php?action=getFile&path=${encodeURIComponent(path)}`);
        const data = await response.json();

        if (data.success) {
            state.currentFile = path;
            state.currentContent = data.content;
            state.isDirty = false;

            editor.value = data.content;
            currentFileName.textContent = data.name;
            updatePreview();
            renderFileTree(); // Re-render to update active state
            saveStatus.textContent = '';
        }
    } catch (error) {
        console.error('Error loading file:', error);
        alert('Error loading file');
    }
}

async function saveFile() {
    if (!state.currentFile) return;

    try {
        saveStatus.textContent = '💾 Saving...';
        saveStatus.className = 'save-status saving';

        const data = await apiFetch('api.php?action=saveFile', {
            body: JSON.stringify({
                path: state.currentFile,
                content: editor.value
            })
        });

        if (data.success) {
            state.currentContent = editor.value;
            state.isDirty = false;
            saveStatus.textContent = '✓ Saved';
            saveStatus.className = 'save-status saved';

            setTimeout(() => {
                saveStatus.textContent = '';
            }, 2000);
        }
    } catch (error) {
        saveStatus.textContent = '✗ Error';
        saveStatus.className = 'save-status';
    }
}

async function deleteItem(path) {
    try {
        const data = await apiFetch('api.php?action=delete', {
            body: JSON.stringify({ path })
        });

        if (data.success) {
            if (state.currentFile === path || state.currentFile?.startsWith(path + '/')) {
                state.currentFile = null;
                state.currentContent = '';
                editor.value = '';
                currentFileName.textContent = 'No file selected';
                preview.innerHTML = '';
            }
            loadFileTree();
        }
    } catch (error) {
        // Error is handled by apiFetch
    }
}

// Modal operations
function showModal(title, onConfirm) {
    modalTitle.textContent = title;
    modalInput.value = '';
    modal.classList.add('active');
    modalInput.focus();

    const confirmHandler = () => {
        const value = modalInput.value.trim();
        if (value) {
            onConfirm(value);
            hideModal();
        }
    };

    modalConfirm.onclick = confirmHandler;
    modalInput.onkeypress = (e) => {
        if (e.key === 'Enter') confirmHandler();
    };
}

function hideModal() {
    modal.classList.remove('active');
    modalInput.value = '';
}

async function createNewFile() {
    showModal('Create New File', async (name) => {
        try {
            const data = await apiFetch('api.php?action=createFile', {
                body: JSON.stringify({ name, path: '' })
            });

            if (data.success) {
                await loadFileTree();
                loadFile(data.path);
            }
        } catch (error) {
            // Error is handled by apiFetch
        }
    });
}

async function createNewFileInFolder(folderPath) {
    showModal('Create New File in ' + folderPath, async (name) => {
        try {
            const data = await apiFetch('api.php?action=createFile', {
                body: JSON.stringify({ name, path: folderPath })
            });

            if (data.success) {
                await loadFileTree();
                loadFile(data.path);
            }
        } catch (error) {
            // Error is handled by apiFetch
        }
    });
}

async function createNewFolder() {
    showModal('Create New Folder', async (name) => {
        try {
            const data = await apiFetch('api.php?action=createFolder', {
                body: JSON.stringify({ name, path: '' })
            });

            if (data.success) {
                loadFileTree();
            }
        } catch (error) {
            // Error is handled by apiFetch
        }
    });
}

// Search functionality
let searchTimeout;
let searchResultsEl;

async function performSearch(query) {
    if (query.length < 2) {
        hideSearchResults();
        return;
    }

    try {
        const response = await fetch(`api.php?action=search&query=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.success) {
            showSearchResults(data.results);
        }
    } catch (error) {
        console.error('Error searching:', error);
    }
}

function showSearchResults(results) {
    if (!searchResultsEl) {
        searchResultsEl = document.createElement('div');
        searchResultsEl.className = 'search-results';
        document.body.appendChild(searchResultsEl);
    }

    if (results.length === 0) {
        searchResultsEl.innerHTML = '<div style="padding: 12px; color: var(--text-secondary);">No results found</div>';
    } else {
        searchResultsEl.innerHTML = results.map(result => `
            <div class="search-result-item" onclick="loadFile('${result.path}')">
                <div class="search-result-name">${result.name}</div>
                <div class="search-result-path">${result.path}</div>
                ${result.matches.map(match => `
                    <div class="search-result-match">Line ${match.line}: ${escapeHtml(match.text)}</div>
                `).join('')}
            </div>
        `).join('');
    }

    positionSearchResults();
    searchResultsEl.classList.add('active');
}

function positionSearchResults() {
    if (!searchResultsEl) return;

    const searchInputRect = searchInput.getBoundingClientRect();
    searchResultsEl.style.top = searchInputRect.bottom + 5 + 'px';
    searchResultsEl.style.left = searchInputRect.left + 'px';
    searchResultsEl.style.width = searchInputRect.width + 'px';
}


function hideSearchResults() {
    if (searchResultsEl) {
        searchResultsEl.classList.remove('active');
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Preview update
function updatePreview() {
    const markdown = editor.value;
    preview.innerHTML = marked.parse(markdown);

    // Re-apply syntax highlighting
    preview.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
}

// Auto-save functionality
let autoSaveTimeout;
function scheduleAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => {
        if (state.isDirty && state.currentFile) {
            saveFile();
        }
    }, 2000); // Auto-save after 2 seconds of inactivity
}

// Mobile sidebar management
function toggleMobileSidebar() {
    sidebar.classList.toggle('mobile-open');
    mobileBackdrop.classList.toggle('active');
}

function closeMobileSidebar() {
    sidebar.classList.remove('mobile-open');
    mobileBackdrop.classList.remove('active');
}

// Mobile preview toggle
function toggleMobilePreview() {
    editorContainer.classList.toggle('mobile-edit-mode');
    const isEditMode = editorContainer.classList.contains('mobile-edit-mode');
    previewToggle.textContent = isEditMode ? '👁️' : '✏️';
    previewToggle.title = isEditMode ? 'Preview only' : 'Edit mode';
}

// Event listeners
function setupEventListeners() {
    // Editor input
    editor.addEventListener('input', () => {
        if (state.currentFile && editor.value !== state.currentContent) {
            state.isDirty = true;
        }
        updatePreview();
        scheduleAutoSave();
    });

    // Manual save with Ctrl+S
    editor.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveFile();
        }
    });

    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);

    // Layout toggle
    layoutToggle.addEventListener('click', toggleLayout);

    // Desktop mode toggle
    if (desktopModeToggle) {
        desktopModeToggle.addEventListener('click', toggleDesktopMode);
    }

    // Preview toggle (mobile)
    previewToggle.addEventListener('click', toggleMobilePreview);

    // Mobile sidebar toggle
    mobileSidebarToggle.addEventListener('click', toggleMobileSidebar);
    mobileBackdrop.addEventListener('click', closeMobileSidebar);

    // New file/folder buttons
    newFileBtn.addEventListener('click', createNewFile);
    newFolderBtn.addEventListener('click', createNewFolder);

    // Modal
    modalCancel.addEventListener('click', hideModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });

    // Search
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length === 0) {
            hideSearchResults();
            return;
        }

        searchTimeout = setTimeout(() => {
            performSearch(query);
        }, 300);
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideSearchResults();
            searchInput.blur();
        }
    });

    // Don't hide search results on blur - let user click on them
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) &&
            (!searchResultsEl || !searchResultsEl.contains(e.target))) {
            hideSearchResults();
        }
    });

    // Divider for resizing
    setupDividerResize();

    // Recalculate search position on resize
    window.addEventListener('resize', positionSearchResults);

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (state.isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

// Divider resize functionality
function setupDividerResize() {
    let isResizing = false;
    let startPos = 0;
    let startSize = 0;

    divider.addEventListener('mousedown', (e) => {
        isResizing = true;
        startPos = state.layout === 'horizontal' ? e.clientX : e.clientY;

        const editorPanel = document.querySelector('.editor-panel');
        const rect = editorPanel.getBoundingClientRect();
        startSize = state.layout === 'horizontal' ? rect.width : rect.height;

        document.body.style.cursor = state.layout === 'horizontal' ? 'col-resize' : 'row-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const editorPanel = document.querySelector('.editor-panel');
        const currentPos = state.layout === 'horizontal' ? e.clientX : e.clientY;
        const diff = currentPos - startPos;
        const newSize = startSize + diff;

        if (state.layout === 'horizontal') {
            editorPanel.style.flex = `0 0 ${newSize}px`;
        } else {
            editorPanel.style.flex = `0 0 ${newSize}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            document.body.style.cursor = '';
        }
    });
}

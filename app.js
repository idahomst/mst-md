const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

// State management
const state = {
    currentFile: null,
    currentContent: '',
    fileTree: [],
    isDirty: false,
    theme: localStorage.getItem('theme') || 'light',
    layout: localStorage.getItem('layout') || 'horizontal',
    desktopMode: localStorage.getItem('desktopMode') || 'preview',
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

// Configure marked
marked.use({
    gfm: true,
    breaks: true,
    highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : 'plaintext';
        return hljs.highlight(code, { language }).value;
    }
});

// Initialize
init();

function init() {
    applyTheme();
    applyLayout();
    applyDesktopMode();
    loadFileTree();
    setupEventListeners();
    refreshIcons();
}

function refreshIcons() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

// Theme management
function applyTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    
    // Update theme toggle icon
    const iconName = state.theme === 'dark' ? 'sun' : 'moon';
    themeToggle.innerHTML = `<i data-lucide="${iconName}"></i>`;

    // Toggle highlight.js themes
    document.getElementById('highlight-light').disabled = state.theme === 'dark';
    document.getElementById('highlight-dark').disabled = state.theme === 'light';
    
    refreshIcons();
}

function toggleTheme() {
    state.theme = state.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('theme', state.theme);
    applyTheme();
}

// Layout management
function applyLayout() {
    editorContainer.classList.toggle('vertical', state.layout === 'vertical');
    
    // Update layout toggle icon
    if (layoutToggle) {
        const iconName = state.layout === 'vertical' ? 'square-split-vertical' : 'columns-2';
        layoutToggle.innerHTML = `<i data-lucide="${iconName}"></i>`;
        refreshIcons();
    }
}

function toggleLayout() {
    state.layout = state.layout === 'horizontal' ? 'vertical' : 'horizontal';
    localStorage.setItem('layout', state.layout);
    applyLayout();
}

// Desktop mode management
function applyDesktopMode() {
    editorContainer.classList.toggle('preview-only', state.desktopMode === 'preview');
    updateDesktopModeButton();
}

function toggleDesktopMode() {
    state.desktopMode = state.desktopMode === 'preview' ? 'edit' : 'preview';
    localStorage.setItem('desktopMode', state.desktopMode);
    applyDesktopMode();
}

function updateDesktopModeButton() {
    if (desktopModeToggle) {
        const isPreview = state.desktopMode === 'preview';
        desktopModeToggle.innerHTML = `<i data-lucide="${isPreview ? 'pen-line' : 'eye'}"></i>`;
        desktopModeToggle.title = isPreview ? 'Edit mode' : 'Preview only';
        refreshIcons();
    }
}

// API wrapper
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
        if (!response.ok) throw new Error(data.error || 'API Error');
        return data;
    } catch (error) {
        console.error('API Error:', error);
        alert(error.message);
        throw error;
    }
}

// File Tree
async function loadFileTree() {
    try {
        const response = await fetch('api.php?action=getTree');
        const data = await response.json();
        if (data.success) {
            state.fileTree = data.tree;
            renderFileTree();
        }
    } catch (error) {
        console.error('Tree Error:', error);
    }
}

function renderFileTree() {
    fileTree.innerHTML = '';
    renderTreeItems(state.fileTree, fileTree);
    refreshIcons();
}

function renderTreeItems(items, container, level = 0) {
    items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'tree-item-container';

        const itemContent = document.createElement('div');
        itemContent.className = 'tree-item';
        if (state.currentFile === item.path) itemContent.classList.add('active');
        itemContent.style.paddingLeft = (level * 16 + 12) + 'px';

        // Toggle / Icon
        if (item.type === 'folder') {
            const toggle = document.createElement('span');
            toggle.className = 'tree-toggle';
            if (state.expandedFolders.has(item.path)) toggle.classList.add('expanded');
            toggle.innerHTML = '<i data-lucide="chevron-right"></i>';
            itemContent.appendChild(toggle);

            const icon = document.createElement('span');
            icon.className = 'tree-item-icon';
            icon.innerHTML = '<i data-lucide="folder"></i>';
            itemContent.appendChild(icon);
        } else {
            const icon = document.createElement('span');
            icon.className = 'tree-item-icon';
            icon.style.marginLeft = '20px'; // Align with folders
            icon.innerHTML = '<i data-lucide="file-text"></i>';
            itemContent.appendChild(icon);
        }

        const name = document.createElement('span');
        name.className = 'tree-item-name';
        name.textContent = item.name;
        itemContent.appendChild(name);

        // Actions
        const actions = document.createElement('span');
        actions.className = 'tree-item-actions';

        if (item.type === 'folder') {
            const addFileBtn = document.createElement('button');
            addFileBtn.className = 'tree-action-btn';
            addFileBtn.innerHTML = '<i data-lucide="file-plus"></i>';
            addFileBtn.onclick = (e) => { e.stopPropagation(); createNewFileInFolder(item.path); };
            actions.appendChild(addFileBtn);
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'tree-action-btn';
        deleteBtn.innerHTML = '<i data-lucide="trash-2"></i>';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Delete ${item.name}?`)) deleteItem(item.path);
        };
        actions.appendChild(deleteBtn);
        itemContent.appendChild(actions);

        // Click Handler
        if (item.type === 'file') {
            itemContent.onclick = () => { loadFile(item.path); closeMobileSidebar(); };
        } else {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';
            const isExpanded = state.expandedFolders.has(item.path);
            childrenContainer.style.display = isExpanded ? 'block' : 'none';

            itemContent.onclick = () => {
                const isNowExpanded = childrenContainer.style.display === 'none';
                childrenContainer.style.display = isNowExpanded ? 'block' : 'none';
                itemContent.querySelector('.tree-toggle').classList.toggle('expanded', isNowExpanded);
                
                if (isNowExpanded) state.expandedFolders.add(item.path);
                else state.expandedFolders.delete(item.path);
                
                localStorage.setItem('expandedFolders', JSON.stringify([...state.expandedFolders]));
                refreshIcons();
            };

            if (item.children) renderTreeItems(item.children, childrenContainer, level + 1);
            itemEl.appendChild(itemContent);
            itemEl.appendChild(childrenContainer);
            container.appendChild(itemEl);
            return;
        }

        itemEl.appendChild(itemContent);
        container.appendChild(itemEl);
    });
}

// File Ops
async function loadFile(path) {
    if (state.isDirty && !confirm('Discard unsaved changes?')) return;

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
            renderFileTree();
            saveStatus.textContent = '';
        }
    } catch (error) { console.error(error); }
}

async function saveFile() {
    if (!state.currentFile) return;
    try {
        saveStatus.textContent = 'Saving...';
        saveStatus.className = 'save-status saving';
        const data = await apiFetch('api.php?action=saveFile', {
            body: JSON.stringify({ path: state.currentFile, content: editor.value })
        });
        if (data.success) {
            state.currentContent = editor.value;
            state.isDirty = false;
            saveStatus.textContent = 'Saved';
            saveStatus.className = 'save-status saved';
            setTimeout(() => { if (!state.isDirty) saveStatus.textContent = ''; }, 2000);
        }
    } catch (error) {
        saveStatus.textContent = 'Error';
        saveStatus.className = 'save-status';
    }
}

async function deleteItem(path) {
    const data = await apiFetch('api.php?action=delete', { body: JSON.stringify({ path }) });
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
}

// Modals
function showModal(title, onConfirm) {
    modalTitle.textContent = title;
    modalInput.value = '';
    modal.classList.add('active');
    modalInput.focus();
    modalConfirm.onclick = () => {
        const val = modalInput.value.trim();
        if (val) { onConfirm(val); hideModal(); }
    };
}
function hideModal() { modal.classList.remove('active'); }

async function createNewFile() {
    showModal('New File', async (name) => {
        const data = await apiFetch('api.php?action=createFile', { body: JSON.stringify({ name, path: '' }) });
        if (data.success) { await loadFileTree(); loadFile(data.path); }
    });
}

async function createNewFileInFolder(folderPath) {
    showModal(`New File in ${folderPath}`, async (name) => {
        const data = await apiFetch('api.php?action=createFile', { body: JSON.stringify({ name, path: folderPath }) });
        if (data.success) { await loadFileTree(); loadFile(data.path); }
    });
}

async function createNewFolder() {
    showModal('New Folder', async (name) => {
        const data = await apiFetch('api.php?action=createFolder', { body: JSON.stringify({ name, path: '' }) });
        if (data.success) loadFileTree();
    });
}

// Search
let searchTimeout;
let searchResultsEl;

async function performSearch(query) {
    if (query.length < 2) { hideSearchResults(); return; }
    const response = await fetch(`api.php?action=search&query=${encodeURIComponent(query)}`);
    const data = await response.json();
    if (data.success) showSearchResults(data.results);
}

function showSearchResults(results) {
    if (!searchResultsEl) {
        searchResultsEl = document.createElement('div');
        searchResultsEl.className = 'search-results';
        document.body.appendChild(searchResultsEl);
    }
    if (results.length === 0) {
        searchResultsEl.innerHTML = '<div style="padding: 16px; color: var(--text-secondary);">No results found</div>';
    } else {
        searchResultsEl.innerHTML = results.map(result => `
            <div class="search-result-item" onclick="loadFile('${result.path}'); hideSearchResults();">
                <div class="search-result-name">${result.name}</div>
                <div class="search-result-path"><i data-lucide="folder" style="width:12px;height:12px"></i> ${result.path}</div>
                ${result.matches.map(match => `
                    <div class="search-result-match">Line ${match.line}: ${escapeHtml(match.text)}</div>
                `).join('')}
            </div>
        `).join('');
    }
    positionSearchResults();
    searchResultsEl.classList.add('active');
    refreshIcons();
}

function positionSearchResults() {
    if (!searchResultsEl) return;
    const rect = searchInput.getBoundingClientRect();
    searchResultsEl.style.top = (rect.bottom + 8) + 'px';
    searchResultsEl.style.left = rect.left + 'px';
    searchResultsEl.style.width = rect.width + 'px';
}

function hideSearchResults() { searchResultsEl?.classList.remove('active'); }
function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

// Preview
function updatePreview() {
    let html = marked.parse(editor.value);
    
    // Simple XSS protection - strip script tags
    html = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");
    
    preview.innerHTML = html;
    preview.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
}

// Auto-save
let autoSaveTimeout;
function scheduleAutoSave() {
    clearTimeout(autoSaveTimeout);
    autoSaveTimeout = setTimeout(() => { if (state.isDirty && state.currentFile) saveFile(); }, 2000);
}

// Mobile
function toggleMobileSidebar() { sidebar.classList.toggle('mobile-open'); mobileBackdrop.classList.toggle('active'); }
function closeMobileSidebar() { sidebar.classList.remove('mobile-open'); mobileBackdrop.classList.remove('active'); }

function toggleMobilePreview() {
    editorContainer.classList.toggle('mobile-edit-mode');
    const isEdit = editorContainer.classList.contains('mobile-edit-mode');
    previewToggle.innerHTML = `<i data-lucide="${isEdit ? 'eye' : 'pen-line'}"></i>`;
    refreshIcons();
}

// Events
function setupEventListeners() {
    editor.addEventListener('input', () => {
        state.isDirty = editor.value !== state.currentContent;
        updatePreview();
        scheduleAutoSave();
    });

    editor.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveFile(); }
    });

    themeToggle.addEventListener('click', toggleTheme);
    layoutToggle.addEventListener('click', toggleLayout);
    desktopModeToggle?.addEventListener('click', toggleDesktopMode);
    previewToggle.addEventListener('click', toggleMobilePreview);
    mobileSidebarToggle.addEventListener('click', toggleMobileSidebar);
    mobileBackdrop.addEventListener('click', closeMobileSidebar);
    newFileBtn.addEventListener('click', createNewFile);
    newFolderBtn.addEventListener('click', createNewFolder);
    modalCancel.addEventListener('click', hideModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) hideModal(); });

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const q = e.target.value.trim();
        if (!q) return hideSearchResults();
        searchTimeout = setTimeout(() => performSearch(q), 300);
    });

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResultsEl?.contains(e.target)) hideSearchResults();
    });

    window.addEventListener('resize', positionSearchResults);
    window.addEventListener('beforeunload', (e) => { if (state.isDirty) { e.preventDefault(); e.returnValue = ''; } });
    
    setupDividerResize();
}

function setupDividerResize() {
    let isResizing = false;
    divider.addEventListener('mousedown', (e) => {
        isResizing = true;
        document.body.style.cursor = state.layout === 'horizontal' ? 'col-resize' : 'row-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        const editorPanel = document.querySelector('.editor-panel');
        if (state.layout === 'horizontal') {
            const newWidth = e.clientX - editorPanel.getBoundingClientRect().left;
            editorPanel.style.flex = `0 0 ${newWidth}px`;
        } else {
            const newHeight = e.clientY - editorPanel.getBoundingClientRect().top;
            editorPanel.style.flex = `0 0 ${newHeight}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = '';
    });
}

// Filesystem functionality for ConstellationFS Web Demo

let currentFileSessionId = null;

function initializeFileSystem(sessionId) {
    currentFileSessionId = sessionId;
    
    // Setup refresh button
    const refreshBtn = document.getElementById('refreshFilesBtn');
    refreshBtn.addEventListener('click', refreshFileExplorer);
    
    // Setup file viewer modal
    setupFileViewer();
    
    // Initial load
    refreshFileExplorer();
}

async function refreshFileExplorer() {
    if (!currentFileSessionId) return;
    
    const fileTree = document.getElementById('fileTree');
    const workspacePath = document.getElementById('workspacePath');
    
    try {
        // Show loading state
        fileTree.innerHTML = '<div class="loading">Loading files...</div>';
        
        const response = await fetch(`/api/filesystem/${currentFileSessionId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Update workspace path
        workspacePath.textContent = data.workspace_path;
        
        // Render file tree
        renderFileTree(data.files);
        
    } catch (error) {
        console.error('Error loading files:', error);
        fileTree.innerHTML = '<div class="loading">Error loading files</div>';
    }
}

function renderFileTree(files) {
    const fileTree = document.getElementById('fileTree');
    
    if (!files || files.length === 0) {
        fileTree.innerHTML = '<div class="empty-state">No files in workspace yet. Ask Claude to create some!</div>';
        return;
    }
    
    // Sort files: directories first, then files
    const sortedFiles = files.sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'directory' ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
    });
    
    const fileTreeHTML = sortedFiles.map(file => {
        const icon = getFileIcon(file);
        const sizeText = file.size !== null ? formatFileSize(file.size) : '';
        
        return `
            <div class="file-item" data-file-path="${escapeHtml(file.path)}" data-file-type="${file.type}">
                <span class="file-icon">${icon}</span>
                <span class="file-name">${escapeHtml(file.name)}</span>
                <span class="file-size">${sizeText}</span>
            </div>
        `;
    }).join('');
    
    fileTree.innerHTML = fileTreeHTML;
    
    // Add click handlers
    const fileItems = fileTree.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        item.addEventListener('click', handleFileClick);
    });
}

function handleFileClick(event) {
    const filePath = event.currentTarget.dataset.filePath;
    const fileType = event.currentTarget.dataset.fileType;
    
    if (fileType === 'file') {
        openFileViewer(filePath);
    }
    // For directories, we could expand/collapse them in the future
}

async function openFileViewer(filePath) {
    const modal = document.getElementById('fileViewerModal');
    const title = document.getElementById('fileViewerTitle');
    const content = document.getElementById('fileViewerContent');
    
    try {
        title.textContent = `📄 ${filePath}`;
        content.textContent = 'Loading...';
        modal.style.display = 'flex';
        
        const response = await fetch(`/api/filesystem/${currentFileSessionId}/read?file_path=${encodeURIComponent(filePath)}`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        content.textContent = data.content;
        
    } catch (error) {
        console.error('Error reading file:', error);
        content.textContent = `Error reading file: ${error.message}`;
    }
}

function setupFileViewer() {
    const modal = document.getElementById('fileViewerModal');
    const closeBtn = document.getElementById('closeFileViewer');
    
    // Close modal handlers
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });
}

function getFileIcon(file) {
    if (file.type === 'directory') {
        return '📁';
    }
    
    const extension = file.name.split('.').pop().toLowerCase();
    
    const iconMap = {
        // Text files
        'txt': '📄',
        'md': '📝',
        'readme': '📋',
        
        // Code files
        'js': '🟨',
        'ts': '🔷',
        'py': '🐍',
        'html': '🌐',
        'css': '🎨',
        'json': '📋',
        'xml': '📋',
        'yaml': '📋',
        'yml': '📋',
        
        // Images
        'png': '🖼️',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'gif': '🖼️',
        'svg': '🖼️',
        
        // Archives
        'zip': '📦',
        'tar': '📦',
        'gz': '📦',
        
        // Executables
        'sh': '⚙️',
        'bat': '⚙️',
        'exe': '⚙️',
        
        // Config
        'conf': '⚙️',
        'config': '⚙️',
        'ini': '⚙️',
        
        // Default
        'default': '📄'
    };
    
    return iconMap[extension] || iconMap['default'];
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make refreshFileExplorer available globally
window.refreshFileExplorer = refreshFileExplorer;
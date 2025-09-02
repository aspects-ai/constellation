// Chat functionality for ConstellationFS Web Demo

let currentSessionId = null;
let eventSource = null;
let isProcessing = false;

function initializeChat(sessionId) {
    currentSessionId = sessionId;
    
    const chatForm = document.getElementById('chatForm');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');
    const chatStatus = document.getElementById('chatStatus');
    
    chatForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const message = chatInput.value.trim();
        if (!message || isProcessing) return;
        
        // Add user message to chat
        addMessage('user', message);
        chatInput.value = '';
        
        // Update UI state
        isProcessing = true;
        updateChatStatus('thinking', 'Claude is thinking...');
        sendBtn.disabled = true;
        
        try {
            // Send message to API
            const response = await fetch('/api/message', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    session_id: currentSessionId
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            // Start listening to stream
            startEventStream();
            
        } catch (error) {
            console.error('Error sending message:', error);
            addMessage('assistant', `Error: ${error.message}`, 'error');
            resetChatState();
        }
    });
    
    // Handle Enter key
    chatInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            chatForm.dispatchEvent(new Event('submit'));
        }
    });
}

function startEventStream() {
    // Close existing connection
    if (eventSource) {
        eventSource.close();
    }
    
    // Start new stream
    eventSource = new EventSource(`/api/stream/${currentSessionId}`);
    
    let assistantMessage = null;
    
    eventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'text':
                    if (!assistantMessage) {
                        assistantMessage = addMessage('assistant', '', 'streaming');
                    }
                    appendToMessage(assistantMessage, data.content);
                    break;
                    
                case 'tool_call':
                    addMessage('tool', `🔧 ${data.content}`, 'tool');
                    if (data.data && data.data.tool_result) {
                        const result = data.data.tool_result;
                        if (result.success) {
                            if (result.output) {
                                addMessage('tool', `Output: ${result.output}`, 'tool');
                            } else if (result.message) {
                                addMessage('tool', result.message, 'tool');
                            }
                        } else {
                            addMessage('tool', `Error: ${result.error}`, 'error');
                        }
                    }
                    break;
                    
                case 'file_update':
                    // Refresh file explorer
                    if (window.refreshFileExplorer) {
                        window.refreshFileExplorer();
                    }
                    break;
                    
                case 'complete':
                    if (assistantMessage) {
                        markMessageComplete(assistantMessage);
                    }
                    resetChatState();
                    eventSource.close();
                    break;
                    
                case 'error':
                    addMessage('assistant', `Error: ${data.content}`, 'error');
                    resetChatState();
                    eventSource.close();
                    break;
            }
        } catch (error) {
            console.error('Error parsing stream data:', error);
        }
    };
    
    eventSource.onerror = function(error) {
        console.error('EventSource error:', error);
        addMessage('assistant', 'Connection error occurred. Please try again.', 'error');
        resetChatState();
        eventSource.close();
    };
}

function addMessage(role, content, type = '') {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role} ${type}`.trim();
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (role === 'user') {
        contentDiv.innerHTML = `<strong>You:</strong> ${escapeHtml(content)}`;
    } else if (role === 'assistant') {
        contentDiv.innerHTML = `<strong>Claude:</strong> <span class="content-text">${escapeHtml(content)}</span>`;
        if (type === 'streaming') {
            contentDiv.innerHTML += '<span class="cursor">▊</span>';
        }
    } else if (role === 'tool') {
        contentDiv.innerHTML = escapeHtml(content);
    }
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return messageDiv;
}

function appendToMessage(messageDiv, content) {
    const contentText = messageDiv.querySelector('.content-text');
    if (contentText) {
        contentText.textContent += content;
    }
    
    // Scroll to bottom
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function markMessageComplete(messageDiv) {
    const cursor = messageDiv.querySelector('.cursor');
    if (cursor) {
        cursor.remove();
    }
    messageDiv.classList.remove('streaming');
}

function updateChatStatus(status, text) {
    const chatStatus = document.getElementById('chatStatus');
    chatStatus.textContent = text;
    chatStatus.className = `status-indicator ${status}`;
}

function resetChatState() {
    isProcessing = false;
    updateChatStatus('ready', 'Ready');
    document.getElementById('sendBtn').disabled = false;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
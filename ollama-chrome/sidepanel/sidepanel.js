/**
 * Side Panel Script
 * Handles chat functionality, streaming responses, and message management
 */

// DOM Elements
const connectionBadge = document.getElementById('connectionBadge');
const modelSelect = document.getElementById('modelSelect');
const includePageContext = document.getElementById('includePageContext');
const chatContainer = document.getElementById('chatContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const charCount = document.getElementById('charCount');
const modelInfo = document.getElementById('modelInfo');
const newChatBtn = document.getElementById('newChatBtn');
const settingsBtn = document.getElementById('settingsBtn');
const thinkingTemplate = document.getElementById('thinkingTemplate');

// State
let isConnected = false;
let isGenerating = false;
let conversationHistory = [];
let currentModel = '';
let abortController = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await checkConnection();
    await loadModels();
    await loadSettings();
    setupEventListeners();
    setupMessageListener();
});

// Check Ollama connection
async function checkConnection() {
    updateConnectionStatus('connecting');

    try {
        const response = await chrome.runtime.sendMessage({ type: 'TEST_CONNECTION' });
        isConnected = response?.connected || false;
        updateConnectionStatus(isConnected ? 'connected' : 'disconnected');
    } catch (error) {
        console.error('Connection check failed:', error);
        isConnected = false;
        updateConnectionStatus('disconnected');
    }
}

function updateConnectionStatus(status) {
    connectionBadge.className = 'connection-badge ' + status;
    const badgeText = connectionBadge.querySelector('.badge-text');

    switch (status) {
        case 'connecting':
            badgeText.textContent = 'Connecting...';
            break;
        case 'connected':
            badgeText.textContent = 'Connected';
            break;
        case 'disconnected':
            badgeText.textContent = 'Disconnected';
            break;
    }
}

// Load available models
async function loadModels() {
    if (!isConnected) {
        modelSelect.innerHTML = '<option value="">Not connected</option>';
        return;
    }

    try {
        const response = await chrome.runtime.sendMessage({ type: 'LIST_MODELS' });
        const models = response?.models || [];

        if (models.length === 0) {
            modelSelect.innerHTML = '<option value="">No models available</option>';
            return;
        }

        modelSelect.innerHTML = models.map(model =>
            `<option value="${model.name}">${model.name}</option>`
        ).join('');

        // Load saved model preference
        const result = await chrome.storage.sync.get(['selectedModel']);
        if (result.selectedModel && modelSelect.querySelector(`option[value="${result.selectedModel}"]`)) {
            modelSelect.value = result.selectedModel;
        }

        currentModel = modelSelect.value;
        updateModelInfo();
    } catch (error) {
        console.error('Failed to load models:', error);
        modelSelect.innerHTML = '<option value="">Error loading</option>';
    }
}

// Load settings
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get(['includePageContext']);
        includePageContext.checked = result.includePageContext ?? true;
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Update model info display
function updateModelInfo() {
    currentModel = modelSelect.value;
    modelInfo.textContent = currentModel ? `Using ${currentModel}` : 'No model selected';
}

// Setup event listeners
function setupEventListeners() {
    // Model selection
    modelSelect.addEventListener('change', async () => {
        currentModel = modelSelect.value;
        updateModelInfo();
        await chrome.storage.sync.set({ selectedModel: currentModel });
    });

    // Page context toggle
    includePageContext.addEventListener('change', async () => {
        await chrome.storage.sync.set({ includePageContext: includePageContext.checked });
    });

    // Message input
    messageInput.addEventListener('input', () => {
        autoResizeTextarea();
        updateCharCount();
        updateSendButton();
    });

    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (canSend()) {
                sendMessage();
            }
        }
    });

    // Send button
    sendBtn.addEventListener('click', () => {
        if (canSend()) {
            sendMessage();
        }
    });

    // Quick prompts
    document.querySelectorAll('.prompt-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const prompt = chip.dataset.prompt;
            messageInput.value = prompt;
            autoResizeTextarea();
            updateCharCount();
            updateSendButton();
            messageInput.focus();
        });
    });

    // New chat
    newChatBtn.addEventListener('click', () => {
        clearChat();
    });

    // Settings
    settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
}

// Listen for messages from background
function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'PROCESS_REQUEST') {
            handleProcessRequest(message);
        } else if (message.type === 'SET_CONTEXT') {
            messageInput.value = `Regarding this text: "${message.text}"\n\n`;
            autoResizeTextarea();
            updateCharCount();
            updateSendButton();
            messageInput.focus();
        }
        sendResponse({ received: true });
        return true;
    });
}

// Handle process request from background/popup
async function handleProcessRequest(request) {
    hideWelcomeScreen();

    let userMessage = request.prompt;

    // Add page context if needed for summarize-page action
    if (request.action === 'summarize-page' && includePageContext.checked) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const [result] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    const selectors = ['article', 'main', '[role="main"]', '.post-content', '.content'];
                    for (const selector of selectors) {
                        const el = document.querySelector(selector);
                        if (el) return el.innerText.substring(0, 8000);
                    }
                    return document.body.innerText.substring(0, 8000);
                }
            });

            if (result?.result) {
                userMessage = `Please provide a comprehensive summary of the following web page content:\n\n${result.result}`;
            }
        } catch (error) {
            console.error('Failed to get page content:', error);
        }
    }

    // Add user message to conversation
    addMessage('user', request.text || userMessage);
    conversationHistory.push({
        role: 'user',
        content: userMessage
    });

    // Generate response
    await generateResponse();
}

// Textarea auto-resize
function autoResizeTextarea() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

// Update character count
function updateCharCount() {
    const count = messageInput.value.length;
    charCount.textContent = `${count} / 10000`;
}

// Check if can send
function canSend() {
    return isConnected &&
        currentModel &&
        messageInput.value.trim().length > 0 &&
        !isGenerating;
}

// Update send button state
function updateSendButton() {
    sendBtn.disabled = !canSend();
}

// Hide welcome screen
function hideWelcomeScreen() {
    welcomeScreen.classList.add('hidden');
}

// Clear chat
function clearChat() {
    conversationHistory = [];
    messagesContainer.innerHTML = '';
    welcomeScreen.classList.remove('hidden');
    messageInput.value = '';
    autoResizeTextarea();
    updateCharCount();
    updateSendButton();
}

// Add message to UI
function addMessage(role, content) {
    hideWelcomeScreen();

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;

    const avatarSvg = role === 'user'
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
       </svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
        <line x1="9" y1="9" x2="9.01" y2="9"/>
        <line x1="15" y1="9" x2="15.01" y2="9"/>
       </svg>`;

    messageDiv.innerHTML = `
    <div class="message-avatar">${avatarSvg}</div>
    <div class="message-content">${formatMessageContent(content)}</div>
  `;

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    return messageDiv;
}

// Format message content (basic markdown)
function formatMessageContent(content) {
    // Escape HTML first
    let formatted = content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Code blocks
    formatted = formatted.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bold
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // Italic
    formatted = formatted.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
}

// Show thinking indicator
function showThinking() {
    const thinking = thinkingTemplate.content.cloneNode(true);
    const thinkingElement = thinking.querySelector('.message');
    thinkingElement.id = 'thinkingIndicator';
    messagesContainer.appendChild(thinking);
    scrollToBottom();
}

// Remove thinking indicator
function removeThinking() {
    const thinking = document.getElementById('thinkingIndicator');
    if (thinking) {
        thinking.remove();
    }
}

// Scroll to bottom
function scrollToBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Send message
async function sendMessage() {
    const content = messageInput.value.trim();
    if (!content) return;

    // Clear input
    messageInput.value = '';
    autoResizeTextarea();
    updateCharCount();
    updateSendButton();

    // Build user message with optional page context
    let userMessage = content;

    if (includePageContext.checked) {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const [result] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => ({
                    title: document.title,
                    url: window.location.href,
                    content: document.body.innerText.substring(0, 4000)
                })
            });

            if (result?.result) {
                const pageInfo = result.result;
                userMessage = `[Context: Currently viewing "${pageInfo.title}" at ${pageInfo.url}]\n\n${content}`;
            }
        } catch (error) {
            // Silently fail - just use the message without context
            console.log('Could not get page context:', error);
        }
    }

    // Add to UI and history
    addMessage('user', content);
    conversationHistory.push({
        role: 'user',
        content: userMessage
    });

    // Generate response
    await generateResponse();
}

// Generate AI response
async function generateResponse() {
    if (!currentModel) {
        addMessage('assistant', 'Please select a model first.');
        return;
    }

    isGenerating = true;
    updateSendButton();
    showThinking();

    try {
        const result = await chrome.storage.sync.get(['ollamaUrl']);
        const baseUrl = result.ollamaUrl || 'http://localhost:11434';

        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: currentModel,
                messages: conversationHistory,
                stream: true
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        removeThinking();

        // Create assistant message element
        const assistantMessage = addMessage('assistant', '');
        const contentDiv = assistantMessage.querySelector('.message-content');
        let fullContent = '';

        // Stream the response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    if (data.message?.content) {
                        fullContent += data.message.content;
                        contentDiv.innerHTML = formatMessageContent(fullContent);
                        scrollToBottom();
                    }
                } catch (e) {
                    // Skip invalid JSON
                }
            }
        }

        // Add to conversation history
        conversationHistory.push({
            role: 'assistant',
            content: fullContent
        });

    } catch (error) {
        console.error('Generation failed:', error);
        removeThinking();

        let errorMsg = `Error: ${error.message}`;
        if (error.message.includes('403')) {
            errorMsg = `
        <strong>Connection Rejected (403)</strong><br><br>
        Ollama blocked the connection. This is a common CORS issue.<br><br>
        <strong>To fix this:</strong><br>
        1. Quit Ollama (Right-click icon in taskbar -> Quit)<br>
        2. Open PowerShell as Admin and run:<br>
        <code>[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "*", "User")</code><br>
        3. Restart Ollama<br><br>
        <em>If you already ran the command, please make sure you fully quit and restarted Ollama.</em>
      `;
        }

        const errorMessage = addMessage('assistant', errorMsg);
        errorMessage.classList.add('error');
    } finally {
        isGenerating = false;
        updateSendButton();
    }
}

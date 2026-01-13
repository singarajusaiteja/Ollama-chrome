/**
 * Background Service Worker
 * Handles extension lifecycle, context menus, and message routing
 */

const DEFAULT_OLLAMA_URL = 'http://localhost:11434';

// Ollama API functions
async function getOllamaUrl() {
    const result = await chrome.storage.sync.get(['ollamaUrl']);
    return result.ollamaUrl || DEFAULT_OLLAMA_URL;
}

async function testConnection() {
    try {
        const baseUrl = await getOllamaUrl();
        const response = await fetch(`${baseUrl}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        return response.ok;
    } catch (error) {
        console.error('Connection test failed:', error);
        return false;
    }
}

async function listModels() {
    try {
        const baseUrl = await getOllamaUrl();
        const response = await fetch(`${baseUrl}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) return [];

        const data = await response.json();
        return data.models || [];
    } catch (error) {
        console.error('Failed to list models:', error);
        return [];
    }
}

async function chat(model, messages) {
    const baseUrl = await getOllamaUrl();
    const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            messages,
            stream: false
        })
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || '';
}

// Create context menus on install
chrome.runtime.onInstalled.addListener(() => {
    // Parent menu
    chrome.contextMenus.create({
        id: 'ollama-parent',
        title: '🦙 Ollama Assistant',
        contexts: ['selection']
    });

    // Submenu items
    chrome.contextMenus.create({
        id: 'ollama-explain',
        parentId: 'ollama-parent',
        title: '💡 Explain this',
        contexts: ['selection']
    });

    chrome.contextMenus.create({
        id: 'ollama-summarize',
        parentId: 'ollama-parent',
        title: '📝 Summarize',
        contexts: ['selection']
    });

    chrome.contextMenus.create({
        id: 'ollama-translate',
        parentId: 'ollama-parent',
        title: '🌐 Translate to English',
        contexts: ['selection']
    });

    chrome.contextMenus.create({
        id: 'ollama-improve',
        parentId: 'ollama-parent',
        title: '✨ Improve writing',
        contexts: ['selection']
    });

    chrome.contextMenus.create({
        id: 'ollama-ask',
        parentId: 'ollama-parent',
        title: '❓ Ask about this...',
        contexts: ['selection']
    });

    console.log('Ollama Assistant installed');
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const selectedText = info.selectionText;
    if (!selectedText) return;

    let prompt = '';
    let action = '';

    switch (info.menuItemId) {
        case 'ollama-explain':
            prompt = `Please explain the following text in simple terms:\n\n"${selectedText}"`;
            action = 'explain';
            break;
        case 'ollama-summarize':
            prompt = `Please provide a concise summary of the following text:\n\n"${selectedText}"`;
            action = 'summarize';
            break;
        case 'ollama-translate':
            prompt = `Please translate the following text to English:\n\n"${selectedText}"`;
            action = 'translate';
            break;
        case 'ollama-improve':
            prompt = `Please improve the writing of the following text while maintaining its meaning:\n\n"${selectedText}"`;
            action = 'improve';
            break;
        case 'ollama-ask':
            // Open side panel for custom question
            await chrome.sidePanel.open({ tabId: tab.id });
            chrome.runtime.sendMessage({
                type: 'SET_CONTEXT',
                text: selectedText
            });
            return;
    }

    if (prompt) {
        // Open side panel and send the request
        await chrome.sidePanel.open({ tabId: tab.id });

        // Small delay to ensure panel is ready
        setTimeout(() => {
            chrome.runtime.sendMessage({
                type: 'PROCESS_REQUEST',
                action,
                text: selectedText,
                prompt
            });
        }, 500);
    }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'toggle_sidepanel') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
            await chrome.sidePanel.open({ tabId: tab.id });
        }
    }
});

// Message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender, sendResponse);
    return true; // Keep channel open for async response
});

async function handleMessage(message, sender, sendResponse) {
    try {
        switch (message.type) {
            case 'TEST_CONNECTION':
                const connected = await testConnection();
                sendResponse({ success: true, connected });
                break;

            case 'LIST_MODELS':
                const models = await listModels();
                sendResponse({ success: true, models });
                break;

            case 'CHAT':
                const response = await chat(message.model, message.messages);
                sendResponse({ success: true, response });
                break;

            case 'GET_PAGE_CONTENT':
                // Request page content from content script
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tab) {
                    chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' }, (content) => {
                        sendResponse({ success: true, content });
                    });
                } else {
                    sendResponse({ success: false, error: 'No active tab' });
                }
                break;

            case 'SUMMARIZE_PAGE':
                const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
                if (activeTab) {
                    chrome.tabs.sendMessage(activeTab.id, { type: 'GET_PAGE_CONTENT' }, async (pageContent) => {
                        if (pageContent) {
                            const result = await chrome.storage.sync.get(['selectedModel']);
                            const model = result.selectedModel || 'llama3.2';

                            const summary = await chat(model, [{
                                role: 'user',
                                content: `Please provide a comprehensive summary of the following web page content:\n\n${pageContent.substring(0, 8000)}`
                            }]);

                            sendResponse({ success: true, summary });
                        } else {
                            sendResponse({ success: false, error: 'Could not get page content' });
                        }
                    });
                }
                break;

            default:
                sendResponse({ success: false, error: 'Unknown message type' });
        }
    } catch (error) {
        console.error('Message handler error:', error);
        sendResponse({ success: false, error: error.message });
    }
}

// Side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false });

console.log('Ollama Assistant background service worker started');

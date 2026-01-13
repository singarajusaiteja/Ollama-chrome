/**
 * Popup Script
 * Handles popup initialization, model selection, and quick actions
 */

// DOM Elements
const connectionStatus = document.getElementById('connectionStatus');
const modelSelect = document.getElementById('modelSelect');
const summarizeBtn = document.getElementById('summarizeBtn');
const chatBtn = document.getElementById('chatBtn');
const explainBtn = document.getElementById('explainBtn');
const translateBtn = document.getElementById('translateBtn');
const settingsBtn = document.getElementById('settingsBtn');
const toast = document.getElementById('toast');

// State
let isConnected = false;
let models = [];

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await checkConnection();
    await loadModels();
    await loadSelectedModel();
    setupEventListeners();
});

// Check Ollama connection
async function checkConnection() {
    updateConnectionStatus('checking');

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

// Update connection status UI
function updateConnectionStatus(status) {
    connectionStatus.className = 'connection-status ' + status;
    const statusText = connectionStatus.querySelector('.status-text');

    switch (status) {
        case 'checking':
            statusText.textContent = 'Checking...';
            break;
        case 'connected':
            statusText.textContent = 'Connected';
            break;
        case 'disconnected':
            statusText.textContent = 'Disconnected';
            break;
    }
}

// Load available models
async function loadModels() {
    if (!isConnected) {
        modelSelect.innerHTML = '<option value="">No connection</option>';
        return;
    }

    try {
        const response = await chrome.runtime.sendMessage({ type: 'LIST_MODELS' });
        models = response?.models || [];

        if (models.length === 0) {
            modelSelect.innerHTML = '<option value="">No models found</option>';
            return;
        }

        modelSelect.innerHTML = models.map(model =>
            `<option value="${model.name}">${model.name}</option>`
        ).join('');
    } catch (error) {
        console.error('Failed to load models:', error);
        modelSelect.innerHTML = '<option value="">Error loading models</option>';
    }
}

// Load previously selected model
async function loadSelectedModel() {
    try {
        const result = await chrome.storage.sync.get(['selectedModel']);
        if (result.selectedModel && modelSelect.querySelector(`option[value="${result.selectedModel}"]`)) {
            modelSelect.value = result.selectedModel;
        }
    } catch (error) {
        console.error('Failed to load selected model:', error);
    }
}

// Save selected model
async function saveSelectedModel(model) {
    try {
        await chrome.storage.sync.set({ selectedModel: model });
    } catch (error) {
        console.error('Failed to save selected model:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Model selection change
    modelSelect.addEventListener('change', (e) => {
        saveSelectedModel(e.target.value);
        showToast('Model updated', 'success');
    });

    // Summarize page
    summarizeBtn.addEventListener('click', async () => {
        if (!isConnected || !modelSelect.value) {
            showToast('Please connect to Ollama and select a model', 'error');
            return;
        }

        summarizeBtn.disabled = true;
        summarizeBtn.classList.add('loading');

        try {
            // Open side panel first
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.sidePanel.open({ tabId: tab.id });

            // Send summarize request
            setTimeout(() => {
                chrome.runtime.sendMessage({
                    type: 'PROCESS_REQUEST',
                    action: 'summarize-page',
                    prompt: 'Please provide a comprehensive summary of this web page.'
                });
            }, 500);

            window.close();
        } catch (error) {
            console.error('Summarize failed:', error);
            showToast('Failed to summarize page', 'error');
        } finally {
            summarizeBtn.disabled = false;
            summarizeBtn.classList.remove('loading');
        }
    });

    // Open chat panel
    chatBtn.addEventListener('click', async () => {
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            await chrome.sidePanel.open({ tabId: tab.id });
            window.close();
        } catch (error) {
            console.error('Failed to open chat:', error);
            showToast('Failed to open chat panel', 'error');
        }
    });

    // Explain selection
    explainBtn.addEventListener('click', async () => {
        if (!isConnected || !modelSelect.value) {
            showToast('Please connect to Ollama and select a model', 'error');
            return;
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Get selected text
            const [result] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => window.getSelection().toString()
            });

            const selectedText = result?.result;

            if (!selectedText || selectedText.trim().length === 0) {
                showToast('Please select some text first', 'error');
                return;
            }

            await chrome.sidePanel.open({ tabId: tab.id });

            setTimeout(() => {
                chrome.runtime.sendMessage({
                    type: 'PROCESS_REQUEST',
                    action: 'explain',
                    text: selectedText,
                    prompt: `Please explain the following text in simple terms:\n\n"${selectedText}"`
                });
            }, 500);

            window.close();
        } catch (error) {
            console.error('Explain failed:', error);
            showToast('Failed to explain selection', 'error');
        }
    });

    // Translate selection
    translateBtn.addEventListener('click', async () => {
        if (!isConnected || !modelSelect.value) {
            showToast('Please connect to Ollama and select a model', 'error');
            return;
        }

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Get selected text
            const [result] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => window.getSelection().toString()
            });

            const selectedText = result?.result;

            if (!selectedText || selectedText.trim().length === 0) {
                showToast('Please select some text first', 'error');
                return;
            }

            await chrome.sidePanel.open({ tabId: tab.id });

            setTimeout(() => {
                chrome.runtime.sendMessage({
                    type: 'PROCESS_REQUEST',
                    action: 'translate',
                    text: selectedText,
                    prompt: `Please translate the following text to English:\n\n"${selectedText}"`
                });
            }, 500);

            window.close();
        } catch (error) {
            console.error('Translate failed:', error);
            showToast('Failed to translate selection', 'error');
        }
    });

    // Settings button
    settingsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
    });
}

// Show toast notification
function showToast(message, type = 'info') {
    const toastMessage = toast.querySelector('.toast-message');
    toastMessage.textContent = message;
    toast.className = `toast ${type} visible`;

    setTimeout(() => {
        toast.classList.remove('visible');
    }, 3000);
}

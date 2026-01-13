/**
 * Options Page Script
 * Handles settings persistence and connection testing
 */

// DOM Elements
const ollamaUrl = document.getElementById('ollamaUrl');
const testConnectionBtn = document.getElementById('testConnectionBtn');
const connectionStatus = document.getElementById('connectionStatus');
const defaultModel = document.getElementById('defaultModel');
const modelItems = document.getElementById('modelItems');
const refreshModelsBtn = document.getElementById('refreshModelsBtn');
const systemPrompt = document.getElementById('systemPrompt');
const defaultPageContext = document.getElementById('defaultPageContext');
const showFloatingButton = document.getElementById('showFloatingButton');
const streamResponses = document.getElementById('streamResponses');
const saveBtn = document.getElementById('saveBtn');
const saveStatus = document.getElementById('saveStatus');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await loadModels();
    setupEventListeners();
});

// Load saved settings
async function loadSettings() {
    try {
        const result = await chrome.storage.sync.get([
            'ollamaUrl',
            'selectedModel',
            'systemPrompt',
            'includePageContext',
            'showFloatingButton',
            'streamResponses'
        ]);

        ollamaUrl.value = result.ollamaUrl || 'http://localhost:11434';
        systemPrompt.value = result.systemPrompt || 'You are a helpful AI assistant. Be concise and clear in your responses. When analyzing web pages, focus on the most important information.';
        defaultPageContext.checked = result.includePageContext ?? true;
        showFloatingButton.checked = result.showFloatingButton ?? true;
        streamResponses.checked = result.streamResponses ?? true;

        if (result.selectedModel) {
            defaultModel.value = result.selectedModel;
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Load available models
async function loadModels() {
    try {
        const baseUrl = ollamaUrl.value || 'http://localhost:11434';
        const response = await fetch(`${baseUrl}/api/tags`);

        if (!response.ok) {
            throw new Error('Failed to connect');
        }

        const data = await response.json();
        const models = data.models || [];

        // Update model select
        if (models.length === 0) {
            defaultModel.innerHTML = '<option value="">No models available</option>';
            modelItems.innerHTML = '<div class="model-empty">No models found. Pull a model with: ollama pull llama3.2</div>';
            return;
        }

        defaultModel.innerHTML = models.map(model =>
            `<option value="${model.name}">${model.name}</option>`
        ).join('');

        // Restore selected model
        const result = await chrome.storage.sync.get(['selectedModel']);
        if (result.selectedModel && defaultModel.querySelector(`option[value="${result.selectedModel}"]`)) {
            defaultModel.value = result.selectedModel;
        }

        // Update model list
        modelItems.innerHTML = models.map(model => {
            const sizeGB = model.size ? (model.size / 1024 / 1024 / 1024).toFixed(1) + ' GB' : 'Unknown size';
            return `
        <div class="model-item">
          <span class="model-name">${model.name}</span>
          <span class="model-size">${sizeGB}</span>
        </div>
      `;
        }).join('');

        updateConnectionStatus('success', `Connected - ${models.length} model(s) available`);
    } catch (error) {
        console.error('Failed to load models:', error);
        defaultModel.innerHTML = '<option value="">Connection failed</option>';
        modelItems.innerHTML = '<div class="model-empty">Could not connect to Ollama. Make sure it\'s running.</div>';
        updateConnectionStatus('error', 'Could not connect to Ollama');
    }
}

// Update connection status UI
function updateConnectionStatus(status, message) {
    connectionStatus.className = 'connection-status ' + status;
    connectionStatus.querySelector('.status-text').textContent = message;
}

// Test connection
async function testConnection() {
    const url = ollamaUrl.value || 'http://localhost:11434';
    updateConnectionStatus('testing', 'Testing connection...');

    try {
        const response = await fetch(`${url}/api/tags`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            const data = await response.json();
            const modelCount = data.models?.length || 0;
            updateConnectionStatus('success', `Connected - ${modelCount} model(s) available`);
            await loadModels();
        } else {
            updateConnectionStatus('error', `HTTP Error: ${response.status}`);
        }
    } catch (error) {
        updateConnectionStatus('error', `Connection failed: ${error.message}`);
    }
}

// Save settings
async function saveSettings() {
    try {
        await chrome.storage.sync.set({
            ollamaUrl: ollamaUrl.value || 'http://localhost:11434',
            selectedModel: defaultModel.value,
            systemPrompt: systemPrompt.value,
            includePageContext: defaultPageContext.checked,
            showFloatingButton: showFloatingButton.checked,
            streamResponses: streamResponses.checked
        });

        showSaveStatus('Settings saved successfully', 'success');
    } catch (error) {
        console.error('Failed to save settings:', error);
        showSaveStatus('Failed to save settings', 'error');
    }
}

// Show save status
function showSaveStatus(message, type) {
    saveStatus.textContent = message;
    saveStatus.className = 'save-status ' + type;

    setTimeout(() => {
        saveStatus.textContent = '';
        saveStatus.className = 'save-status';
    }, 3000);
}

// Setup event listeners
function setupEventListeners() {
    testConnectionBtn.addEventListener('click', testConnection);
    refreshModelsBtn.addEventListener('click', loadModels);
    saveBtn.addEventListener('click', saveSettings);

    // Auto-save on model change
    defaultModel.addEventListener('change', () => {
        chrome.storage.sync.set({ selectedModel: defaultModel.value });
    });

    // Detect changes
    const inputs = [ollamaUrl, systemPrompt, defaultPageContext, showFloatingButton, streamResponses];
    inputs.forEach(input => {
        input.addEventListener('change', () => {
            saveStatus.textContent = 'Unsaved changes';
            saveStatus.className = 'save-status';
        });
    });
}

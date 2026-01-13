# Ollama Assistant - Chrome Extension

A powerful Chrome extension that brings local AI assistance to your browser using Ollama models. Similar to "Claude for Chrome" but runs completely locally with your choice of open-source models.

![Ollama Assistant](icons/icon128.svg)

## ✨ Features

- **🎯 Text Selection Actions** - Select text on any page and get instant AI explanations, summaries, or translations
- **📄 Page Summarization** - Summarize entire web pages with one click
- **💬 Chat Interface** - Side panel with persistent chat for Q&A about current page content
- **🖱️ Context Menu** - Right-click integration for quick AI actions
- **🔄 Streaming Responses** - See AI responses as they're generated in real-time
- **🎨 Premium Dark UI** - Beautiful, modern interface with smooth animations
- **🔒 100% Private** - All processing happens locally on your machine

## 📋 Prerequisites

1. **Install Ollama** - Download and install from [ollama.com](https://ollama.com)
2. **Pull a model** - Run `ollama pull llama3.2` or any other model
3. **Start Ollama** - Make sure Ollama is running (usually starts automatically)

## 🚀 Installation

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `ollama-chrome` folder
6. The extension icon should appear in your toolbar!

## 🎮 Usage

### Quick Actions (Popup)
Click the extension icon to:
- See connection status
- Select your preferred model
- Summarize the current page
- Open the chat panel

### Text Selection
1. Select any text on a webpage
2. A floating button appears - click it to ask about the selection
3. Or right-click and choose from the Ollama Assistant menu:
   - 💡 Explain this
   - 📝 Summarize
   - 🌐 Translate to English
   - ✨ Improve writing

### Chat Panel
1. Press `Ctrl+Shift+L` or click "Open Chat" in the popup
2. Type your question in the input area
3. Toggle "Include page context" to let the AI reference the current page
4. Use quick prompts for common actions

### Settings
Click the settings icon to configure:
- Ollama server URL (default: `http://localhost:11434`)
- Default model selection
- System prompt customization
- Behavior preferences

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+O` | Open extension popup |
| `Ctrl+Shift+L` | Toggle chat side panel |

## 🛠️ Configuration

### Custom Ollama URL
If Ollama is running on a different port or machine:
1. Open extension settings
2. Change the Ollama Server URL
3. Click "Test" to verify connection
4. Save settings

### System Prompt
Customize how the AI responds by editing the system prompt in settings.

## 📁 Project Structure

```
ollama-chrome/
├── manifest.json          # Extension manifest (MV3)
├── background.js          # Service worker
├── content.js             # Page interaction script
├── content.css            # Floating button styles
├── lib/
│   └── ollama.js          # Ollama API client
├── popup/
│   ├── popup.html         # Popup interface
│   ├── popup.css          # Popup styles
│   └── popup.js           # Popup logic
├── sidepanel/
│   ├── sidepanel.html     # Chat interface
│   ├── sidepanel.css      # Chat styles
│   └── sidepanel.js       # Chat logic with streaming
├── options/
│   ├── options.html       # Settings page
│   ├── options.css        # Settings styles
│   └── options.js         # Settings logic
└── icons/
    ├── icon16.svg
    ├── icon32.svg
    ├── icon48.svg
    └── icon128.svg
```

## 🤝 Supported Models

Works with any Ollama model including:
- `llama3.2` - Great general-purpose model
- `mistral` - Fast and capable
- `codellama` - Optimized for code
- `phi` - Compact and efficient
- `gemma2` - Google's open model
- And many more!

## 🐛 Troubleshooting

### "403 Forbidden" or Connection Failed
This is usually a CORS issue. By default, Ollama blocks requests from browser extensions.

**To fix this on Windows:**
1. Quit Ollama from the taskbar (right-click icon -> Quit)
2. Open PowerShell as Administrator
3. Run this command:
   ```powershell
   [Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "*", "User")
   ```
4. Restart Ollama (search for Ollama in Start menu)

**To fix on Mac/Linux:**
1. Run `OLLAMA_ORIGINS="*" ollama serve`
2. Or add `OLLAMA_ORIGINS="*"` to your environment variables

### No models showing
- Pull at least one model: `ollama pull llama3.2`
- Click the refresh button in settings

### Slow responses
- Larger models require more resources
- Try a smaller model like `phi` or `gemma2:2b`
- Check your system's RAM and GPU usage

## 📝 License

MIT License - Feel free to modify and distribute!

## 🙏 Acknowledgments

- [Ollama](https://ollama.com) for making local LLMs accessible
- Inspired by Claude for Chrome by Anthropic

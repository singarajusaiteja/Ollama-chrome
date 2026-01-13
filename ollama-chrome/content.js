/**
 * Content Script
 * Handles page interaction, text selection, and content extraction
 */

// Page content extraction
function getPageContent() {
    // Get main content, avoiding navigation, footer, ads, etc.
    const selectors = [
        'article',
        'main',
        '[role="main"]',
        '.post-content',
        '.article-content',
        '.entry-content',
        '#content',
        '.content'
    ];

    let content = '';

    for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
            content = element.innerText;
            break;
        }
    }

    // Fallback to body if no main content found
    if (!content) {
        content = document.body.innerText;
    }

    // Clean up the content
    content = content
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n\n')
        .trim();

    return content;
}

// Get page metadata
function getPageMetadata() {
    return {
        title: document.title,
        url: window.location.href,
        description: document.querySelector('meta[name="description"]')?.content || '',
        content: getPageContent()
    };
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'GET_PAGE_CONTENT':
            sendResponse(getPageContent());
            break;
        case 'GET_PAGE_METADATA':
            sendResponse(getPageMetadata());
            break;
        case 'GET_SELECTED_TEXT':
            sendResponse(window.getSelection().toString());
            break;
    }
    return true;
});

// Floating action button for text selection
let floatingButton = null;

function createFloatingButton() {
    if (floatingButton) return floatingButton;

    floatingButton = document.createElement('div');
    floatingButton.id = 'ollama-floating-btn';
    floatingButton.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
    </svg>
  `;
    floatingButton.title = 'Ask Ollama about this';

    floatingButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const selectedText = window.getSelection().toString().trim();
        if (selectedText) {
            chrome.runtime.sendMessage({
                type: 'OPEN_SIDEPANEL_WITH_TEXT',
                text: selectedText
            });
        }

        hideFloatingButton();
    });

    document.body.appendChild(floatingButton);
    return floatingButton;
}

function showFloatingButton(x, y) {
    const button = createFloatingButton();

    // Position the button near the selection
    const offset = 10;
    button.style.left = `${x + offset}px`;
    button.style.top = `${y + offset}px`;
    button.classList.add('visible');
}

function hideFloatingButton() {
    if (floatingButton) {
        floatingButton.classList.remove('visible');
    }
}

// Handle text selection
document.addEventListener('mouseup', (e) => {
    // Ignore if clicking on the floating button
    if (e.target.closest('#ollama-floating-btn')) return;

    const selectedText = window.getSelection().toString().trim();

    if (selectedText && selectedText.length > 3) {
        showFloatingButton(e.pageX, e.pageY);
    } else {
        hideFloatingButton();
    }
});

// Hide button when clicking elsewhere
document.addEventListener('mousedown', (e) => {
    if (!e.target.closest('#ollama-floating-btn')) {
        hideFloatingButton();
    }
});

// Hide button on scroll
document.addEventListener('scroll', hideFloatingButton);

console.log('Ollama Assistant content script loaded');

(function () {
  'use strict';

  const chatWindow = document.getElementById('chatWindow');
  const composerForm = document.getElementById('composerForm');
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const typingIndicator = document.getElementById('typingIndicator');
  const errorBanner = document.getElementById('errorBanner');
  const clearBtn = document.getElementById('clearBtn');
  const statusLine = document.getElementById('statusLine');

  const SESSION_KEY = 'nlp_chatbot_session_id';

  function getSessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : 'sess-' + Date.now() + '-' + Math.random().toString(16).slice(2));
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  let sessionId = getSessionId();

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function appendMessage({ role, text, intent, confidence }) {
    const wrapper = document.createElement('div');
    wrapper.className = 'message message--' + role;

    const bubble = document.createElement('div');
    bubble.className = 'message__bubble';
    bubble.innerHTML = escapeHtml(text);

    const meta = document.createElement('div');
    meta.className = 'message__meta';
    let metaText = formatTime(new Date());
    meta.textContent = metaText;

    if (role === 'bot' && intent && intent !== 'fallback') {
      const tag = document.createElement('span');
      tag.className = 'message__intent-tag';
      const pct = typeof confidence === 'number' ? Math.round(confidence * 100) : null;
      tag.textContent = pct !== null ? `${intent} (${pct}%)` : intent;
      meta.appendChild(tag);
    }

    wrapper.appendChild(bubble);
    wrapper.appendChild(meta);
    chatWindow.appendChild(wrapper);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function showError(message) {
    errorBanner.textContent = message;
    errorBanner.hidden = false;
    setTimeout(() => {
      errorBanner.hidden = true;
    }, 5000);
  }

  function setBusy(isBusy) {
    sendBtn.disabled = isBusy;
    typingIndicator.hidden = !isBusy;
    if (isBusy) {
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }
  }

  async function sendMessage(text) {
    appendMessage({ role: 'user', text });
    setBusy(true);
    statusLine.textContent = 'Typing...';

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId,
        },
        body: JSON.stringify({ message: text }),
      });

      const returnedSessionId = response.headers.get('x-session-id');
      if (returnedSessionId) {
        sessionId = returnedSessionId;
        localStorage.setItem(SESSION_KEY, sessionId);
      }

      let data;
      try {
        data = await response.json();
      } catch (parseErr) {
        throw new Error('Received an invalid response from the server.');
      }

      if (!response.ok) {
        throw new Error(data && data.message ? data.message : 'Something went wrong. Please try again.');
      }

      appendMessage({ role: 'bot', text: data.reply, intent: data.intent, confidence: data.confidence });
      if (data.task) {
        window.parent.postMessage({ type: 'task-added', task: data.task }, window.location.origin);
      }
    } catch (err) {
      showError(err.message || 'Unable to reach the server. Please check your connection and try again.');
      appendMessage({
        role: 'bot',
        text: "Sorry, I couldn't process that. Please try again in a moment.",
      });
    } finally {
      setBusy(false);
      statusLine.textContent = 'Online';
    }
  }

  composerForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;
    messageInput.value = '';
    autoResize();
    sendMessage(text);
  });

  // Enter sends the message; Shift+Enter inserts a newline.
  messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      composerForm.requestSubmit();
    }
  });

  function autoResize() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
  }
  messageInput.addEventListener('input', autoResize);

  clearBtn.addEventListener('click', async () => {
    try {
      await fetch('/api/chat/session', {
        method: 'DELETE',
        headers: { 'x-session-id': sessionId },
      });
    } catch (err) {
      // Non-fatal: even if the server call fails, we still clear the UI.
      console.warn('Failed to clear server-side session:', err);
    } finally {
      chatWindow.innerHTML = '';
      renderWelcomeMessage();
    }
  });

  function renderWelcomeMessage() {
    appendMessage({
      role: 'bot',
      text: "Hi! I'm your support assistant. Ask me about our services, pricing, working hours, or how to get in touch.",
    });
  }

  // Initial state
  renderWelcomeMessage();
  messageInput.focus();
})();

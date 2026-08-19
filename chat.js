const messages = [];

function addMessage(role, content) {
  const message = document.createElement('div');
  message.className = `chat-message ${role}`;
  message.textContent = content;
  document.getElementById('chatMessages').appendChild(message);
  document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
}

async function sendChatMessage(event) {
  event.preventDefault();
  const input = document.getElementById('chatInput');
  const button = document.getElementById('chatSend');
  const content = input.value.trim();
  if (!content || button.disabled) return;

  input.value = '';
  messages.push({ role: 'user', content });
  addMessage('user', content);
  button.disabled = true;
  input.disabled = true;
  addMessage('assistant loading', 'Escribiendo…');

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'No pudimos responder.');

    document.querySelector('.chat-message.loading')?.remove();
    messages.push({ role: 'assistant', content: data.content });
    addMessage('assistant', data.content);
  } catch (error) {
    document.querySelector('.chat-message.loading')?.remove();
    addMessage('assistant error', error.message);
  } finally {
    button.disabled = false;
    input.disabled = false;
    input.focus();
  }
}

document.getElementById('chatToggle').addEventListener('click', () => {
  const widget = document.getElementById('chatWidget');
  const isOpen = widget.classList.toggle('open');
  document.getElementById('chatToggle').setAttribute('aria-expanded', String(isOpen));
  if (isOpen) document.getElementById('chatInput').focus();
});

document.getElementById('chatForm').addEventListener('submit', sendChatMessage);
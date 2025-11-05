// Get chatbot elements
const chatbotToggleBtn = document.getElementById('chatbotToggleBtn');
const chatbotPanel = document.getElementById('chatbotPanel');

if (chatbotToggleBtn && chatbotPanel) {
  // Toggle chat open/closed when clicking the button
  chatbotToggleBtn.addEventListener('click', () => {
    chatbotPanel.classList.toggle('open');
  });

  // Close chat when clicking anywhere except the chat panel or button
  document.addEventListener('click', (e) => {
    // If chat is open AND user clicked outside chat area, close it
    if (chatbotPanel.classList.contains('open') && 
        !chatbotPanel.contains(e.target) && 
        !chatbotToggleBtn.contains(e.target)) {
      chatbotPanel.classList.remove('open');
    }
  });
}

// Chat functionality: send user input to OpenAI Chat Completions API and display the reply.
// NOTE: For demo purposes this uses the API key from `secrets.js` (client-side).
// In production you should never expose your API key in client-side code.

const chatbotMessages = document.getElementById('chatbotMessages');
const chatbotInput = document.getElementById('chatbotInput');
const chatbotSendBtn = document.getElementById('chatbotSendBtn');

// Keep a short message history for the conversation (includes a system prompt).
const messageHistory = [
  {
    role: 'system',
    content: `You are WayChat, Waymark’s friendly creative assistant.

Waymark is a video ad creation platform that helps people turn ideas, products, or messages into high-quality, ready-to-run videos. The platform is used by small businesses, agencies, and marketers to create broadcast-   ads with minimal friction.

Your job is to help users shape raw input — whether it’s a business name, a tagline, a product, a vibe, or a rough idea — into a short-form video concept.

Your responses may include suggested video structures, voiceover lines, tone and visual direction, music suggestions, and clarifying follow-up questions.

If the user's input is unclear, ask 1–2 short questions to help sharpen the direction before offering creative suggestions.

Only respond to questions related to Waymark, its tools, its platform, or the creative process of making short-form video ads. If a question is unrelated, politely explain that you're focused on helping users create video ads with Waymark.

Keep your replies concise, collaborative, and focused on helping users express their message clearly. Always align with modern marketing best practices — and stay supportive and friendly.`
  }
];

// Helper to append a message element to the messages container
function appendMessage(role, text) {
  if (!chatbotMessages) return;
  const wrapper = document.createElement('div');
  wrapper.className = `chat-message ${role}`; // e.g. 'chat-message user' or 'chat-message assistant'
  const msg = document.createElement('div');
  msg.className = 'chat-bubble';
  // Create paragraph-separated content so the assistant's reply can show
  // separate sections (script, tone, CTA) instead of one large block.
  function createBubbleContent(container, txt) {
    // Split on two or more newlines to get sections
    const sections = String(txt).split(/\n\s*\n/);
    sections.forEach((sec) => {
      const p = document.createElement('p');
      p.textContent = sec.trim();
      container.appendChild(p);
    });
  }

  createBubbleContent(msg, text);
  wrapper.appendChild(msg);
  chatbotMessages.appendChild(wrapper);
  // scroll to bottom
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  return msg;
}

// Show a small error message in the chat window
function appendError(text) {
  appendMessage('assistant', `Error: ${text}`);
}

// Call OpenAI Chat Completions API with messageHistory and return assistant text
async function callOpenAI() {
  if (typeof OPENAI_API_KEY === 'undefined' || !OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is missing. Put it in secrets.js for this demo.');
  }

  const url = 'https://api.openai.com/v1/chat/completions';
  // Build a shallow copy of the conversation so the assistant sees the full history
  const messages = messageHistory.map(m => ({ role: m.role, content: m.content }));

  const body = {
    model: 'gpt-4o',
    messages: messages,
    // Make the assistant slightly more creative and keep replies short
    temperature: 0.8,
    max_completion_tokens: 300
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`API request failed: ${resp.status} ${resp.statusText} - ${errText}`);
  }

  const data = await resp.json();
  // Guard against unexpected shape
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Unexpected API response format');
  }
  return data.choices[0].message.content;
}

// Send current input as a message
async function sendCurrentMessage() {
  if (!chatbotInput || !chatbotInput.value) return;
  const text = chatbotInput.value.trim();
  if (!text) return;

  // Append user message to UI and history
  appendMessage('user', text);
  messageHistory.push({ role: 'user', content: text });
  chatbotInput.value = '';

  // Add a placeholder for assistant reply so user sees a loading state
  const assistantPlaceholder = appendMessage('assistant', 'Thinking');
  chatbotSendBtn.disabled = true;

  // Start a small "thinking" dot animation by updating the placeholder text.
  const bubbleEl = assistantPlaceholder; // chat-bubble div returned from appendMessage
  const firstPara = bubbleEl.querySelector('p');
  const textNodeTarget = firstPara || bubbleEl;
  let dotCount = 0;
  const thinkingInterval = setInterval(() => {
    dotCount = (dotCount + 1) % 4; // 0..3
    const dots = '.'.repeat(dotCount);
    textNodeTarget.textContent = `Thinking${dots}`;
    // keep scroll pinned to bottom while thinking
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }, 400);

  try {
    const assistantText = await callOpenAI();
    // stop animation and replace placeholder text with actual assistant reply
    clearInterval(thinkingInterval);
    textNodeTarget.textContent = assistantText;
    messageHistory.push({ role: 'assistant', content: assistantText });
  } catch (err) {
    clearInterval(thinkingInterval);
    console.error(err);
    textNodeTarget.textContent = 'Sorry, something went wrong.';
    appendError(err.message);
  } finally {
    chatbotSendBtn.disabled = false;
    chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  }
}

// Wire up send button and Enter key
if (chatbotSendBtn && chatbotInput) {
  chatbotSendBtn.addEventListener('click', (e) => {
    e.preventDefault();
    sendCurrentMessage();
  });

  chatbotInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendCurrentMessage();
    }
  });
}

// Accessibility: press Enter on the toggle button to open the chat
if (chatbotToggleBtn) {
  chatbotToggleBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') chatbotToggleBtn.click();
  });
}

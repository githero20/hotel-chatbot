interface ApiResponse {
  answer: string;
  threadId: string;
}

// Global variables
let threadId: string = localStorage.getItem("threadId") || "";
const chatMessages = document.getElementById("chatMessages")!;
const messageInput = document.getElementById(
  "messageInput"
) as HTMLInputElement;
const chatForm = document.getElementById("chatForm") as HTMLFormElement;
const sendButton = document.getElementById("sendButton") as HTMLButtonElement;
const typingIndicator = document.getElementById("typingIndicator")!;
const suggestions = document.getElementById("suggestions")!;

// Initialize when DOM loads
document.addEventListener("DOMContentLoaded", () => {
  initializeChatbot();
});

function initializeChatbot(): void {
  chatForm.addEventListener("submit", handleSubmit);
  setupSuggestionChips();
  setInitialTime();
  messageInput.focus();

  // Add some keyboard shortcuts
  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  });
}

function setupSuggestionChips(): void {
  const chips = suggestions.querySelectorAll(".suggestion-chip");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const message = chip.getAttribute("data-message");
      if (message) {
        messageInput.value = message;
        handleSubmit(new Event("submit"));
      }
    });
  });
}

function setInitialTime(): void {
  const initialTimeElement = document.getElementById("initialTime");
  if (initialTimeElement) {
    initialTimeElement.textContent = formatTime(new Date());
  }
}

async function handleSubmit(event: Event): Promise<void> {
  event.preventDefault();

  const message = messageInput.value.trim();
  if (!message) return;

  // Hide suggestions after first message
  if (suggestions.style.display !== "none") {
    suggestions.style.display = "none";
  }

  // Add user message
  addMessage("user", message);

  // Clear input and show loading
  messageInput.value = "";
  toggleSendButton(false);
  showTypingIndicator();

  try {
    const response = await sendMessageToBackend(message);
    hideTypingIndicator();
    addMessage("bot", response.answer);
    if (threadId === "" && response.threadId) {
      localStorage.setItem("threadId", response.threadId);
      threadId = response.threadId;
    }
    if (response.threadId) {
      localStorage.setItem("threadId", response.threadId);
      threadId = response.threadId;
    }
  } catch (error) {
    hideTypingIndicator();
    console.error("Error:", error);
    addMessage(
      "bot",
      "❌ Sorry, I encountered an error connecting to the server. Please check your connection and try again.",
      true
    );
  } finally {
    toggleSendButton(true);
    messageInput.focus();
  }
}

async function sendMessageToBackend(message: string): Promise<ApiResponse> {
  const payload: any = { question: message, threadId };

  const response = await fetch("/api/chatbot/ask", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Server responded with ${response.status}: ${errorText}`);
  }

  return await response.json();
}

function addMessage(
  role: "user" | "bot",
  content: string,
  isError = false
): void {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${role}-message${
    isError ? " error-message" : ""
  }`;

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "message-bubble";

  // Add some formatting for bot messages
  if (role === "bot" && !isError) {
    bubbleDiv.innerHTML = formatBotMessage(content);
  } else {
    bubbleDiv.textContent = content;
  }

  const timeDiv = document.createElement("div");
  timeDiv.className = "message-time";
  timeDiv.textContent = formatTime(new Date());

  contentDiv.appendChild(bubbleDiv);
  contentDiv.appendChild(timeDiv);
  messageDiv.appendChild(contentDiv);
  chatMessages.appendChild(messageDiv);

  scrollToBottom();
}

function formatBotMessage(content: string): string {
  // Basic formatting for better readability
  return content
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // Bold text
    .replace(/\*(.*?)\*/g, "<em>$1</em>") // Italic text
    .replace(/\n/g, "<br>") // Line breaks
    .replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    ); // Links
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function showTypingIndicator(): void {
  typingIndicator.classList.add("show");
  scrollToBottom();
}

function hideTypingIndicator(): void {
  typingIndicator.classList.remove("show");
}

function toggleSendButton(enabled: boolean): void {
  sendButton.disabled = !enabled;
}

function scrollToBottom(): void {
  setTimeout(() => {
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, 100);
}

// Add some utility functions for better UX
function showConnectionStatus(isOnline: boolean): void {
  const statusDot = document.querySelector(".status-dot") as HTMLElement;
  const statusText = statusDot?.nextElementSibling as HTMLElement;

  if (statusDot && statusText) {
    if (isOnline) {
      statusDot.style.background = "#48bb78";
      statusText.textContent = "Online";
    } else {
      statusDot.style.background = "#f56565";
      statusText.textContent = "Offline";
    }
  }
}

// Monitor online/offline status
window.addEventListener("online", () => showConnectionStatus(true));
window.addEventListener("offline", () => showConnectionStatus(false));

// Add some helpful keyboard shortcuts info (optional)
function showKeyboardShortcuts(): void {
  console.log("OSCA Chatbot Keyboard Shortcuts:");
  console.log("• Enter: Send message");
  console.log("• Shift + Enter: New line");
  console.log("• Esc: Clear input");
}

// Clear input on Escape
messageInput.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    messageInput.value = "";
  }
});

// Show shortcuts in console on load
setTimeout(showKeyboardShortcuts, 1000);

// use this to compile script.ts after edit
// npx tsc [script.ts](http://_vscodecontentref_/5) --outDir dist --target ES2020 --module ES2020

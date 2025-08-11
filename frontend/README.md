# OSCA Chatbot Frontend

A minimal, well-designed chatbot frontend for the Open Source Africa Fest, built with pure HTML, CSS, and TypeScript (no frameworks).

## 🌍 About OSCA Fest

This chatbot serves as a digital assistant for the **Open Source Africa Festival**, helping attendees get information about speakers, sessions, schedules, and general event details.

## ✨ Features

- **🎨 OSCA Branding**: Modern design with Africa-inspired green/blue theme
- **💬 Real-time Chat**: Interactive chat interface with typing indicators
- **🔘 Smart Suggestions**: Pre-built question chips for common inquiries
- **📱 Responsive Design**: Works perfectly on mobile, tablet, and desktop
- **⚡ Fast & Lightweight**: No frameworks - pure vanilla TypeScript
- **🌐 Online Status**: Connection status indicator
- **⌨️ Keyboard Shortcuts**: Enter to send, Esc to clear input
- **🧵 Thread Continuity**: Maintains conversation context
- **❌ Error Handling**: User-friendly error messages
- **🎭 Smooth Animations**: Professional transitions and micro-interactions

## 📁 Project Structure

```
frontend/
├── index.html          # Main HTML structure
├── styles.css          # Complete styling (responsive)
├── script.ts           # TypeScript source code
├── dist/
│   └── script.js       # Compiled JavaScript output
└── README.md           # This file
```

## 🚀 Quick Start

### 1. Compile TypeScript

```bash
cd frontend
npx tsc script.ts --outDir dist --target ES2020 --module ES2020
```

### 2. Start your backend server

The frontend expects your backend to be running with the chat API endpoint.

### 3. Open the chatbot

- If integrated with your server: Visit `http://localhost:5000`
- For development: Open `index.html` in your browser (after setting up a local server)

## 🔗 Backend Integration

The frontend communicates with your backend through a simple REST API:

### API Endpoint

```
POST /api/chatbot/chat
```

### Request Format

```json
{
  "question": "What time does OSCA Fest start?",
  "threadId": "optional-thread-id-for-continuity"
}
```

### Response Format

```json
{
  "answer": "OSCA Fest starts at 9:00 AM WAT...",
  "threadId": "thread-123-abc"
}
```

## 🛠️ Development Setup

### Prerequisites

- Node.js and npm installed
- TypeScript compiler (`npm install -g typescript`)

### Local Development

1. **Clone and navigate to frontend directory**
2. **Compile TypeScript**: `npx tsc script.ts --outDir dist --target ES2020 --module ES2020`
3. **Start a local server** (using Python, Node.js, or VS Code Live Server)
4. **Ensure your backend is running** on the expected port

### File Watching (Auto-compile)

```bash
npx tsc script.ts --outDir dist --target ES2020 --module ES2020 --watch
```

## 🎨 Customization

### Update Branding

- **Colors**: Edit CSS gradient variables in `styles.css`
- **Logo**: Replace the 🌍 emoji in `index.html`
- **Welcome Message**: Update the initial bot message
- **Suggestion Chips**: Modify question suggestions in HTML

### Add New Features

- **Message Formatting**: Extend `formatBotMessage()` function
- **Additional UI**: Add new components in HTML/CSS
- **API Integration**: Modify `sendMessageToBackend()` function

## 📱 Responsive Breakpoints

- **Mobile**: < 768px (optimized for touch)
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px (full feature set)

## ⌨️ Keyboard Shortcuts

- **Enter**: Send message
- **Shift + Enter**: New line in message
- **Escape**: Clear input field

## 🎯 Suggestion Chips

Pre-configured questions for OSCA Fest:

- "What is OSCA Fest?"
- "Who are the keynote speakers?"
- "What's the event schedule?"
- "How to register?"

## 🚦 Status Indicators

- **Green dot**: Connected and ready
- **Red dot**: Connection issues
- **Typing animation**: Bot is processing response

## 📦 Production Deployment

### 1. Build for Production

```bash
npx tsc script.ts --outDir dist --target ES2020 --module ES2020
```

### 2. Optimize Assets

- Minify CSS/JS if needed
- Optimize images
- Enable gzip compression on server

### 3. Server Integration

Your backend server should:

- Serve static files from the `frontend` directory
- Handle the `/api/chatbot/chat` endpoint
- Return proper error responses

## 🧪 Testing

### Manual Testing Checklist

- [ ] Chat interface loads correctly
- [ ] Messages send and receive properly
- [ ] Suggestion chips work
- [ ] Mobile responsive design
- [ ] Error handling for network issues
- [ ] Typing indicators appear/disappear
- [ ] Thread continuity maintained
- [ ] Keyboard shortcuts functional

## 🔧 Troubleshooting

### TypeScript Compilation Errors

```bash
# Install TypeScript globally
npm install -g typescript

# Compile with detailed errors
npx tsc script.ts --outDir dist --target ES2020 --module ES2020 --strict
```

### API Connection Issues

- Verify backend server is running
- Check network tab in browser dev tools
- Confirm API endpoint matches frontend calls
- Validate request/response formats

### Styling Issues

- Clear browser cache
- Check CSS file path in HTML
- Verify responsive design in dev tools
- Test on different screen sizes

## 🤝 Contributing

1. Make changes to source files (`script.ts`, `styles.css`, `index.html`)
2. Compile TypeScript: `npx tsc script.ts --outDir dist --target ES2020 --module ES2020`
3. Test thoroughly on different devices
4. Update this README if adding new features

## 📄 License

This project is part of the hotel-chatbot repository. Check the main project license for details.

---

**Built with ❤️ for Open Source Africa Fest 2025**

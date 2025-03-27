# 🏨 FAQ-based AI Chatbot (RAG)

This **Retrieval-Augmented Generation** application is a **FAQ-based AI chatbot** that answers customer queries based on stored **FAQs**.
This chatbot uses LangGraph from LangChain, Groq AI's large language model, Mistral AI's embeddings, and a memory-based vector store to deliver precise and contextual responses.
It also integrates tools for retrieving and processing knowledge from a knowledge base, ensuring a seamless conversational experience.

## 🚀 Features

- **AI-Powered Chatbot**: Answers customer questions based on a provided FAQ document.
- **Node.js API with Express**: Provides REST endpoints for passing the responses via API.
- **Embeddings for Search**: Uses Mistral AI to generate embeddings.
- **Tool-Based Query Processing**: Leverages LangGraph's tool calling feature to rewrite and optimize user queries for accurate answers.
- **AI-Powered Conversations**: Employs a state-of-the-art language model, Groq AI's **llama-3.3-70b-versatile**, for natural language understanding.

## 🛠 Setup & Installation

### **1️⃣ Clone the Repository**

```sh
git clone https://github.com/githero20/hotel-chatbot.git
cd hotel-chatbot
```

### **2️⃣ Install Dependencies**

```sh
npm install
```

### **3️⃣ Configure Environment Variables**

Create a `.env` file and add:

```ini
PORT=5000
MISTRAL_API_KEY=<your-API-key>
GROQ_API_KEY=<your-API-key>
```

### **4️⃣ Start the Node.js Server**

```sh
npm start
```

## 📜 License

This project is licensed under the **MIT License**.

---

## 🙌 Contributing

Feel free to fork the project and submit a PR if you have improvements!

---

🚀 Happy Coding! 🎉

# 🏨 Hotel Management AI Chatbot with ChromaDB

This project is a **hotel management AI chatbot** that answers customer queries based on stored **FAQs**. It uses **ChromaDB** as a vector database to store and retrieve knowledge efficiently.

## 🚀 Features

- **AI-Powered Chatbot**: Answers customer questions based on FAQs.
- **ChromaDB for Vector Storage**: Stores hotel FAQs for efficient retrieval.
- **Node.js API with Express**: Provides REST endpoints for storing and querying data.
- **Embeddings for Search**: Uses OpenAI or another model to generate embeddings.
- **Docker Support**: Runs ChromaDB in a containerized environment.

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
CHROMA_DB_URL=http://localhost:8000
PORT=5000
MISTRAL_API_KEY=<your-API-key>
HF_TOKEN=<your-API-key>
; this is optional and is necessary only if you want to use a purely OSS model instead

```

### **4️⃣ Start ChromaDB with Docker**

Ensure you have **Docker** installed, then run:

```sh
docker-compose up -d
```

### **5️⃣ Start the Node.js Server**

```sh
npm start
```

---

## ✅ Future Improvements

- **Integrate Hugging Face Models** for embedding generation.
- **Enhance AI Chatbot** with better NLP capabilities.
- **Improve Vector Search** using fine-tuned embeddings.

---

## 📜 License

This project is licensed under the **MIT License**.

---

## 🙌 Contributing

Feel free to fork the project and submit a PR if you have improvements!

---

🚀 Happy Coding! 🎉

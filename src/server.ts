import app from "./app";
import { initFAQs } from "./services/chatbotGraph.services";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  console.log("🚀 Starting Server...");

  try {
    console.log("🟢 Initializing FAQs in vector store...");
    const vectorStore = await initFAQs(); // Load FAQs into ChromaDB at startup
    if (vectorStore !== undefined || vectorStore !== null)
      console.log("✅ FAQs initialized successfully.");
  } catch (error) {
    console.error("❌ Failed to initialize FAQs:", error);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer();

// docker pull chromadb/chroma
// docker run -p 8000:8000 chromadb/chroma
// docker ps

// http://localhost:8000/api//v2/tenants/default_tenant/databases/default_database/collections

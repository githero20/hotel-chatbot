import app from "./app";
import { initFAQs } from "./chatbotOld";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  console.log("🚀 Starting Server...");

  try {
    console.log("🟢 Initializing FAQs in vector store...");
    await initFAQs(); // Load FAQs into ChromaDB at startup
    console.log("✅ FAQs initialized successfully.");
  } catch (error) {
    console.error("❌ Failed to initialize FAQs:", error);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
};

startServer();

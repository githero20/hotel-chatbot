import app from "./app";
import { initFAQs } from "./services/chatbotGraph.services";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  console.log("🚀 Starting Server...");

  try {
    console.log("🟢 Initializing FAQs in vector store...");
    const vectorStore = await initFAQs();
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

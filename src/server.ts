import app from "./app";
import { cleanupVectorStore, initFAQs } from "./services/chatbotGraph.services";
import path from "path";
import express from "express";

const PORT = process.env.PORT || 5000;
const MEMORY_THRESHOLD = 450 * 1024 * 1024; // 450MB for Render free tier

// Memory monitoring function
// the vector store used for this demo is an in-memory store from LangGraph
const checkMemoryUsage = () => {
  const used = process.memoryUsage();
  console.log("🧮 Memory Usage:");
  console.log(`- Heap Used: ${Math.round(used.heapUsed / 1024 / 1024)}MB`);
  console.log(`- Heap Total: ${Math.round(used.heapTotal / 1024 / 1024)}MB`);

  if (used.heapUsed > MEMORY_THRESHOLD) {
    console.warn("⚠️ High memory usage detected! Cleaning up...");
    cleanupVectorStore();
    global.gc && global.gc(); // Force garbage collection if available
  }
};

const startServer = async () => {
  console.log("🚀 Starting Server...");

  try {
    console.log("🟢 Initializing FAQs in vector store...");
    checkMemoryUsage(); // Check initial memory state and clean up existing vector store before initializing
    const vectorStore = await initFAQs();
    if (vectorStore !== undefined || vectorStore !== null)
      console.log("✅ FAQs initialized successfully.");
  } catch (error) {
    console.error("❌ Failed to initialize FAQs:", error);
    checkMemoryUsage();
  }

  // Serve static files from the frontend directory
  app.use(express.static(path.join(__dirname, "../frontend")));

  // Serve the main HTML file at the root route
  app.get("/", (_req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/index.html"));
  });

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📱 Chat interface available at http://localhost:${PORT}`);
  });
};

// Handle cleanup on shutdown
process.on("SIGTERM", async () => {
  console.log("📥 SIGTERM received. Cleaning up...");
  await cleanupVectorStore();
  process.exit(0);
});

startServer();

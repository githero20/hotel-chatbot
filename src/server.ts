import app from "./app";
import { initFAQs } from "./services/chatbotGraph.services";
import path from "path";
import express from "express";

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

startServer();

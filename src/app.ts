import express from "express";
import cors from "cors";
import chatbotRoutes from "./routes/chatbot.routes";

const app = express();

app.use(express.json()); // Middleware to parse JSON
app.use(cors()); // Enable CORS for frontend access

app.use("/api/chatbot", chatbotRoutes);

export default app;

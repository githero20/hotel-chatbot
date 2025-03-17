import express from "express";
import { askQuestion } from "../controller/chatbot.controller";

const router = express.Router();

router.post("/ask", askQuestion);

export default router;

import express from "express";
// import { answerQuestion } from "../services/chatbot.services";
import { askQuestion } from "../controller/chatbot.controller";

const router = express.Router();

// @route    POST api/chatbot/ask
router.post("/ask", askQuestion);

export default router;

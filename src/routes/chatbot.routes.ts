import express from "express";
import { askQuestion } from "../controller/chatbot.controller";

const router = express.Router();

// @route    POST api/chatbot/ask
router.post("/ask", askQuestion);

// router.post("/ask", async (req, res) => {
//   try {
//     const { question } = req.body;
//     if (!question) {
//       return res.status(400).json({ error: "Question is required." });
//     }
//     const answer = await answerQuestion(question);
//     res.json({ answer });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

export default router;

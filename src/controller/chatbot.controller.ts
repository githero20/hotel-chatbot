import { Request, Response } from "express";
import { answerQuestion } from "../services/chatbot.services";

export async function askQuestion(req: Request, res: Response) {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: "Question is required." });
    }
    const answer = await answerQuestion(question);
    res.json({ answer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

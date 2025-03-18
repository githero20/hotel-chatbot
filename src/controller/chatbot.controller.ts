import { Request, Response } from "express";
import { answerQuestion } from "../services/chatbotGraph.services";

export async function askQuestion(req: Request, res: Response): Promise<void> {
  try {
    const { question } = req.body;
    if (!question) {
      res.status(400).json({ error: "Question is required." });
      return;
    }
    const answer = await answerQuestion(question);
    res.json({ answer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

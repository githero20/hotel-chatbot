import { Request, Response } from "express";
import { answerQuestion } from "../services/chatbotGraphNew.services";

export async function askQuestion(req: Request, res: Response): Promise<void> {
  try {
    const { question, threadId } = req.body;
    if (!question) {
      res.status(400).json({ error: "Question is required." });
      return;
    }
    const answer = await answerQuestion(question, threadId);
    res.json({ answer });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

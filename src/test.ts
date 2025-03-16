import { initFAQs, answerQuestion } from "./chatbot"; // Adjust filename

(async () => {
  const vectorStore = await initFAQs();

  const response = await answerQuestion(
    "What was my last question?",
    vectorStore
  );

  console.log(response);
})();

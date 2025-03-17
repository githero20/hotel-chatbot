import { initFAQs, answerQuestion } from "./chatbot"; // Adjust filename

(async () => {
  const vectorStore = await initFAQs();

  const response = await answerQuestion(
    "What happens when there is a power outage?",
    vectorStore
  );

  console.log(response);
})();

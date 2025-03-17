import { answerQuestion } from "./services/chatbot.services"; // Adjust filename

(async () => {
  const response = await answerQuestion(
    "What happens when there is a power outage?"
  );

  console.log(response);
})();

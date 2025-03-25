import { answerQuestion } from "./trash/chatbotChainOld.services"; // Adjust filename

(async () => {
  const response = await answerQuestion(
    "What happens when there is a power outage?"
  );

  console.log(response);
})();

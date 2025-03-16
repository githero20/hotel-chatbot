import { answerQuestion, initFAQs } from "./chatbot";

async function main() {
  const vRes = await initFAQs();
  await answerQuestion("Is the hotel always open?", vRes);
}

main();

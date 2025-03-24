import {
  AIMessage,
  BaseMessage,
  HumanMessage,
  isAIMessage,
  ToolMessage,
} from "@langchain/core/messages";

export const extractFinalAIResponse = (messages: BaseMessage[]): string => {
  // Find the last human message first
  let lastHumanIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i] instanceof HumanMessage) {
      lastHumanIndex = i;
      break;
    }
  }

  if (lastHumanIndex === -1) {
    return "No human question found.";
  }

  // Find the AI responses after the last human message
  let aiResponses: AIMessage[] = [];
  for (let i = lastHumanIndex + 1; i < messages.length; i++) {
    if (isAIMessage(messages[i]) && !(messages[i] instanceof ToolMessage)) {
      // Only consider "final" AI responses, not ones that make tool calls
      if (!(messages[i] as AIMessage).tool_calls?.length) {
        aiResponses.push(messages[i] as AIMessage);
      }
    }
  }

  // Return the most recent AI response's content, or a message if none found
  if (aiResponses.length > 0) {
    return aiResponses[aiResponses.length - 1].content as string;
  } else {
    return "No AI response found after the last human question.";
  }
};

// const prettyPrint = (message: BaseMessage) => {
//   let txt = `[${message._getType()}]: ${message.content}`;
//   if ((isAIMessage(message) && message.tool_calls?.length) || 0 > 0) {
//     const tool_calls = (message as AIMessage)?.tool_calls
//       ?.map((tc) => `- ${tc.name}(${JSON.stringify(tc.args)})`)
//       .join("\n");
//     txt += ` \nTools: \n${tool_calls}`;
//   }
//   console.log(txt);

//   return txt;
// };

// for await (const step of await resGraph.stream(inputs, {
//   streamMode: "values",
// })) {
//   const lastMessage = step.messages[step.messages.length - 1];
//   prettyPrint(lastMessage);
//   console.log("-----\n");
// }

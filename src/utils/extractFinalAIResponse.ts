import {
  AIMessage,
  BaseMessage,
  // HumanMessage,
  isAIMessage,
  // ToolMessage,
} from "@langchain/core/messages";

// export const extractFinalAIResponse = (messages: BaseMessage[]): string => {
//   // Find the last human message first
//   let lastHumanIndex = -1;
//   for (let i = messages.length - 1; i >= 0; i--) {
//     if (messages[i] instanceof HumanMessage) {
//       lastHumanIndex = i;
//       break;
//     }
//   }

//   if (lastHumanIndex === -1) {
//     return "No human question found.";
//   }

//   // Find the AI responses after the last human message
//   let aiResponses: AIMessage[] = [];
//   for (let i = lastHumanIndex + 1; i < messages.length; i++) {
//     if (isAIMessage(messages[i]) && !(messages[i] instanceof ToolMessage)) {
//       // Only consider "final" AI responses, not ones that make tool calls
//       if (!(messages[i] as AIMessage).tool_calls?.length) {
//         aiResponses.push(messages[i] as AIMessage);
//       }
//     }
//   }

//   // Return the most recent AI response's content, or a message if none found
//   if (aiResponses.length > 0) {
//     return aiResponses[aiResponses.length - 1].content as string;
//   } else {
//     return "No AI response found after the last human question.";
//   }
// };

// export const logAIConversation = async (
//   resGraph: any,
//   input: any,
//   threadId: string
// ) => {
//   // It takes a BaseMessage object as input (which could be a HumanMessage, AIMessage, SystemMessage, or ToolMessage)
//   // It creates a formatted string with the message type and content: [type]: content
//   // If the message is an AIMessage with tool calls, it also formats and adds those tool calls to the output
//   // It logs the formatted string to the console
//   // It also returns the formatted text (though in your original code, this return value wasn't being used)
//   const prettyPrint = (message: BaseMessage) => {
//     let txt = `[${message.getType()}]: ${message.content}`;
//     if ((isAIMessage(message) && message.tool_calls?.length) || 0 > 0) {
//       const tool_calls = (message as AIMessage)?.tool_calls
//         ?.map((tc) => `- ${tc.name}(${JSON.stringify(tc.args)})`)
//         .join("\n");
//       txt += ` \nTools: \n${tool_calls}`;
//     }
//     console.log(txt);
//     return txt;
//   };

//   const threadConfig = {
//     configurable: { thread_id: threadId },
//     streamMode: "values" as const,
//   };

//   for await (const step of await resGraph.stream(input, threadConfig)) {
//     const lastMessage = step.messages[step.messages.length - 1];
//     prettyPrint(lastMessage);
//     console.log("-----\n");
//   }
// };

export const exportLastAIMsg = async (
  resGraph: any,
  input: any,
  threadId: string
) => {
  // It takes a BaseMessage object as input (which could be a HumanMessage, AIMessage, SystemMessage, or ToolMessage)
  // It creates a formatted string with the message type and content: [type]: content
  // If the message is an AIMessage with tool calls, it also formats and adds those tool calls to the output
  // It logs the formatted string to the console
  // It also returns the formatted text (though in your original code, this return value wasn't being used)
  const prettyPrint = (message: BaseMessage) => {
    let txt = `[${message.getType()}]: ${message.content}`;
    if ((isAIMessage(message) && message.tool_calls?.length) || 0 > 0) {
      const tool_calls = (message as AIMessage)?.tool_calls
        ?.map((tc) => `- ${tc.name}(${JSON.stringify(tc.args)})`)
        .join("\n");
      txt += ` \nTools: \n${tool_calls}`;
    }
    console.log(txt);
  };

  const threadConfig = {
    configurable: { thread_id: threadId },
    streamMode: "values" as const,
  };

  console.log(threadConfig);

  let lastAIMessage: AIMessage | null = null;

  for await (const step of await resGraph.stream(input, threadConfig)) {
    const lastMessage = step.messages[step.messages.length - 1];

    // Pretty-print the message
    prettyPrint(lastMessage);
    console.log("-----\n");

    // Check if the last message is an AIMessage and update lastAIMessage
    if (isAIMessage(lastMessage)) {
      lastAIMessage = lastMessage as AIMessage;
    }
  }

  // Return the last AIMessage if found
  return lastAIMessage?.content as string;
};

//  "threadId": "a68c1ab1-4892-4db3-b246-7b482e5b6402"
// "threadId": "d2464c6e-ef76-47c1-84dd-114f2dabf59d"

import { AIMessage, BaseMessage, isAIMessage } from "@langchain/core/messages";

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

  // logs the graph conversation in console
  // can be used to see how the query is rewritten before being sent to the llm
  // and also what relevant content is extracted and how it is used

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

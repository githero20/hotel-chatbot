import { MistralAIEmbeddings } from "@langchain/mistralai";
// import { ChatGroq } from "@langchain/groq";
import { ChatOpenAI } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { splitDocs } from "../utils/splitDocs";
import {
  MemorySaver,
  MessagesAnnotation,
  StateGraph,
} from "@langchain/langgraph";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { ToolNode, toolsCondition } from "@langchain/langgraph/prebuilt";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  trimMessages,
} from "@langchain/core/messages";
import { encodingForModel } from "@langchain/core/utils/tiktoken";
import { TavilySearch } from "@langchain/tavily";
import { v4 as uuidv4 } from "uuid";
import { exportLastAIMsg } from "../utils/exportLastAIMsg";

// Instantiate LLM, Groq AI
// const llm = new ChatGroq({
//   model: "llama-3.3-70b-versatile",
//   temperature: 0,
// });
const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0,
});

// Instantiate Mistral AI embedding model
const embeddings = new MistralAIEmbeddings({
  model: "mistral-embed",
});
// Holds the in-memory graph data (type currently unknown)
let vectorStore: MemoryVectorStore | null = null;
// Holds the in-memory graph data (type currently unknown)
let resGraph: unknown = null;

// initialize vector store and load with external knowledge base
export const initFAQs = async () => {
  if (vectorStore) return vectorStore; // Prevent reloading if already initialized
  console.log("Default vector store", vectorStore);
  const chunks = await splitDocs("osca-fest-faq.md"); // Load and split the required document
  console.log("🟢 Initializing vector store...");

  // Initialise vector store
  vectorStore = new MemoryVectorStore(embeddings);
  await vectorStore.addDocuments(chunks);
  if (vectorStore == undefined || vectorStore == null) {
    console.warn("⚠ Vector store creation failed");
  }
  console.log("✅ Vector store initialized successfully with relevant FAQs.");

  return vectorStore;
};

// creates graph and returns a graph
export const createGraph = async () => {
  if (!vectorStore) {
    console.warn("⚠ Vector store not initialized, initializing now...");
    await initFAQs();
  }

  // this schema allows the model to rewrite user queries into more effective search queries
  const retrieveSchema = z.object({ query: z.string() });

  // this converts the retriever function into a tool that must return a query
  const retrieve = tool(
    async ({ query }) => {
      try {
        const retrievedDocs = await vectorStore!.similaritySearchWithScore(
          query,
          2
        );

        const relevantDocs = retrievedDocs.filter(
          ([_doc, score]) => score >= 0.8
        );

        const serialized = relevantDocs
          .map(
            ([doc, _score]) =>
              `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`
          )
          .join("\n");
        return serialized || "NO_RELEVANT_INFO";
      } catch (error) {
        console.error("Error in retrieve tool:", error);
        return "NO_RELEVANT_INFO";
      }
    },
    {
      name: "retrieve",
      description:
        "Search the FAQ database for information about OSCA fest schedule, events, and activities.",
      schema: retrieveSchema,
    }
  );

  // Add Tavily search tool
  const tavilySearch = new TavilySearch({
    maxResults: 3,
  });

  // Prepares the conversation context and lets the LLM decide whether to use the retrieval tool or respond directly.
  // if the LLM decides to use the retrieval tool, it will return an AI message type with tool calls that the ToolNode will
  // execute with the retrieve function
  // if not, the tool calls will be empty and the LLM will respond directly
  async function queryOrRespond(state: typeof MessagesAnnotation.State) {
    const llmWithTools = llm.bindTools([retrieve, tavilySearch]); // tells the LLM about available tools

    // Add system message with clear instructions,
    // enabling the LLM to decide whether to call a tool or respond directly
    const systemMessage = new SystemMessage(
      "You are a helpful assistant with access to two tools:\n" +
        "1. 'retrieve' - ALWAYS Use this for questions related to OSCA Fest or Open Source Africa fest " +
        "including schedule, events, activities, etc.\n" +
        "2. 'tavily_search' - Use this for general information, current events, " +
        "weather, local attractions, etc.\n" +
        "When asked a question, ALWAYS choose the most appropriate tool based on the question type. " +
        "DO NOT ATTEMPT TO ANSWER, unless you are sure neither of the tools are necessary " +
        "For OSCA fest-related questions, ALWAYS use 'retrieve' first. For general questions, use 'tavily_search'. \n" +
        "Formulate a search query based on the user's question."
    );

    // Combines with existing messages but ensure the system message is first
    // this should ensure that the model keeps our prompt top of mind
    const conversationMessages = state.messages.filter(
      (message) =>
        message instanceof HumanMessage ||
        message instanceof SystemMessage ||
        (message instanceof AIMessage &&
          (!message.tool_calls || message.tool_calls?.length == 0))
    );

    const messagesWithSystem = [systemMessage, ...conversationMessages];

    // trims to the last 1500 tokens to prevent the messages from getting too long
    const trimmer = trimMessages({
      maxTokens: 1500,
      strategy: "last",
      tokenCounter: async (msgs) => {
        // Get the encoding for the model
        const encoding = await encodingForModel("gpt-3.5-turbo");
        let totalTokens = 0;

        for (const msg of msgs) {
          // Count tokens in the message content
          if (typeof msg.content === "string") {
            totalTokens += encoding.encode(msg.content).length;
          }
          // Add a small overhead for message metadata (role, etc.)
          totalTokens += 4; // Rough estimate for message overhead
        }

        console.log(`Total tokens in messages: ${totalTokens}`);

        return totalTokens;
      },
      includeSystem: true,
      allowPartial: false,
      startOn: "human",
    });

    const trimmedMessages = await trimmer.invoke(messagesWithSystem); // returns trimmed messages

    const response = await llmWithTools.invoke(trimmedMessages); // returns the LLM response, which may include tool calls

    console.log("query response", response);

    //     Total tokens in messages: 124
    // query response AIMessage {
    //   "content": "",
    //   "additional_kwargs": {
    //     "tool_calls": [
    //       {
    //         "id": "anwxdh243",
    //         "type": "function",
    //         "function": "[Object]"
    //       }
    //     ]
    //   },
    //   "response_metadata": {
    //     "tokenUsage": {
    //       "completionTokens": 17,
    //       "promptTokens": 1186,
    //       "totalTokens": 1203
    //     },
    //     "finish_reason": "tool_calls"
    //   },
    //   "tool_calls": [
    //     {
    //       "name": "retrieve",
    //       "args": {
    //         "query": "hotel check-in time"
    //       },
    //       "type": "tool_call",
    //       "id": "anwxdh243"
    //     }
    //   ],
    //   "invalid_tool_calls": [],
    //   "usage_metadata": {
    //     "input_tokens": 1186,
    //     "output_tokens": 17,
    //     "total_tokens": 1203
    //   }
    // }

    // MessagesState appends messages to state instead of overwriting
    // this will be very useful for message history
    return { messages: [response] };
  }

  // Instantiate ToolNode with the retrieve tool
  // ToolNode receives the AIMessage with tool_calls (from the LLM response)
  // ToolNode executes the retrieve function
  // ToolNode returns ToolMessage with the results
  const tools = new ToolNode([retrieve, tavilySearch]);

  //   // After ToolNode processes the tool_calls:
  // {
  //   role: "tool",
  //   content: "Check-in time is 3:00 PM...",
  //   tool_call_id: "abc123"
  // }

  async function queryContext(state: typeof MessagesAnnotation.State) {
    const llmWithTavily = llm.bindTools([tavilySearch]);

    const lastToolMessage = [...state.messages]
      .reverse()
      .find((msg) => msg instanceof ToolMessage);

    const docsContent =
      typeof lastToolMessage === "string"
        ? lastToolMessage
        : lastToolMessage?.content ?? "";

    // // Check if results contain the NO_RELEVANT_INFO signal
    // const hasNoRelevantInfo = docsContent.includes("NO_RELEVANT_INFO");

    // Get the user's most recent question (last HumanMessage in state.messages)
    let userQuestionRaw =
      [...state.messages].reverse().find((msg) => msg instanceof HumanMessage)
        ?.content ?? "";
    const userQuestion: string = Array.isArray(userQuestionRaw)
      ? userQuestionRaw
          .map((c) => (typeof c === "string" ? c : JSON.stringify(c)))
          .join(" ")
      : userQuestionRaw;

    // Create appropriate system message based on context analysis
    let systemPrompt;

    // if (hasNoRelevantInfo) {
    //   console.log(
    //     "📊 Retrieved context not relevant, instructing to use tavily_search"
    //   );
    //   systemPrompt =
    //     "The OSCA Fest FAQ database doesn't contain relevant information for this question. " +
    //     "Use the 'tavily_search' tool to find information from the web. " +
    //     "Search specifically for OSCA Fest or Open Source Africa Festival information.";

    //   // Create prompt with ONLY the system message and user question, not the full state
    //   const prompt = [
    //     new SystemMessage(systemPrompt),
    //     new HumanMessage(userQuestion),
    //   ];

    //   const response = await llmWithTavily.invoke(prompt);
    //   return { messages: [response] };
    // } else {
    systemPrompt =
      "You are a helpful OSCA Fest assistant with access to retrieved context. " +
      "Review the context below and determine if it answers the user's question.\n\n" +
      `"${userQuestion}"\n\n` +
      "If the context is RELEVANT and SUFFICIENT, respond with 'CONTEXT_GOOD'.\n" +
      "If the context is NOT RELEVANT or INSUFFICIENT, ALWAYS use the 'tavily_search' tool " +
      "to find more relevant information from the web.\n\n" +
      `Context:\n${docsContent}`;

    const prompt = [new SystemMessage(systemPrompt), ...state.messages];

    console.log("queryContext prompt", prompt);

    console.log("📝 Evaluating context relevance");
    const response = await llmWithTavily.invoke(prompt);

    console.log("queryContext response", response);

    // If LLM explicitly says context is good, we can move to generate
    if (
      response.content &&
      typeof response.content === "string" &&
      response.content.includes("CONTEXT_GOOD")
    ) {
      console.log("✅ Context deemed sufficient by LLM");

      return {
        messages: [new AIMessage("CONTEXT_GOOD")],
      };
    } else {
      return { messages: [response] };
    }
    // }
  }

  // Generates a response using the retrieved content.
  // i.e. combines the user's query with the retrieved content, sends this to the LLM and returns the response
  async function generate(state: typeof MessagesAnnotation.State) {
    const lastToolMessage = [...state.messages]
      .reverse()
      .find((msg) => msg instanceof ToolMessage);

    const docsContent =
      typeof lastToolMessage === "string"
        ? lastToolMessage
        : lastToolMessage?.content ?? "";

    // Get the user's most recent question (last HumanMessage in state.messages)
    let userQuestionRaw =
      [...state.messages].reverse().find((msg) => msg instanceof HumanMessage)
        ?.content ?? "";
    const userQuestion: string = Array.isArray(userQuestionRaw)
      ? userQuestionRaw
          .map((c) => (typeof c === "string" ? c : JSON.stringify(c)))
          .join(" ")
      : userQuestionRaw;

    const systemMessageContent =
      "You are a knowledgeable and very helpful assistant with access to a list of FAQs." +
      "Use the following pieces of retrieved context to answer " +
      "the user's question. " +
      `"${userQuestion}"\n\n` +
      "If you don't know the answer, just say that you " +
      "don't know, don't try to make up an answer." +
      "Use three sentences maximum and keep the answer as concise as possible \n\n" +
      `Retrieved context: ${docsContent}`;

    // get all messages relevant to the conversation from the state, i.e. no AI messages with tool calls
    // this way we have a list of messages that are relevant to the conversation
    // while the tool message responses have been converted to context above
    const conversationMessages = state.messages.filter(
      (message) =>
        message instanceof HumanMessage ||
        message instanceof SystemMessage ||
        (message instanceof AIMessage &&
          (!message.tool_calls || message.tool_calls?.length == 0))
    );

    // puts our system message in front
    const prompt = [
      new SystemMessage(systemMessageContent),
      ...conversationMessages,
    ];

    console.log("final prompt", prompt);

    //     -----
    // final prompt [
    //   SystemMessage {
    //     "content": "You are a knowledgeable and very helpful assistant with access to a list of FAQs.Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know, don't try to make up an answer.Use three sentences maximum and keep the answer as concise as possible\n\nSource: FAQs.docx\nContent: Hotel FAQs\n\nWhat are the check-in and check-out times?\n\nCheck-in time is 3:00 PM, and check-out time is 11:00 AM. Early check-in and late check-out may be available upon request.\n\nDo you offer free Wi-Fi?\n\nYes, we provide complimentary Wi-Fi access throughout the hotel.\n\nIs breakfast included in the room rate?\n\nBreakfast options vary by rate plan. Please check your reservation details or contact the front desk for more information.\n\nWhat is your cancellation policy?\n\nOur cancellation policy varies by rate type. Please refer to your reservation confirmation or contact us for specific details.\n\nDo you have parking available?\n\nYes, we offer on-site parking for guests. Please inquire about parking fees and availability at the front desk.\n\nAre pets allowed in the hotel?\n\nOur hotel has a pet-friendly policy. Please check with us for specific pet policies and any associated fees.\n\nIs there a fitness center available?\nSource: FAQs.docx\nContent: Are pets allowed in the hotel?\n\nOur hotel has a pet-friendly policy. Please check with us for specific pet policies and any associated fees.\n\nIs there a fitness center available?\n\nYes, we have a fitness center equipped with various exercise machines and free weights for guest use.\n\nDo you have a swimming pool?\n\nYes, we have an indoor/outdoor swimming pool available for guests. Please check the pool hours at the front desk.\n\nCan I request a room with a specific view?\n\nWhile we cannot guarantee specific views, we will do our best to accommodate your request based on availability.\n\nWhat amenities are included in the rooms?\n\nOur rooms typically include a flat-screen TV, mini-fridge, coffee maker, and complimentary toiletries. Please check the room description for specific amenities.\n\nDo you offer airport shuttle service?\n\nYes, we provide airport shuttle service. Please contact the front desk for schedules and fees.\n\nIs there a restaurant on-site?",
    //     "additional_kwargs": {},
    //     "response_metadata": {}
    //   },
    //   HumanMessage {
    //     "id": "a41ce6a3-fc0c-4dcf-a318-dde8c69611eb",
    //     "content": "What is the hotel check-in time?",
    //     "additional_kwargs": {},
    //     "response_metadata": {}
    //   }
    // ]
    // [ai]: The hotel check-in time is 3:00 PM. Early check-in may be available upon request. Check-out time is 11:00 AM.
    // -----

    // Run
    console.log("Generating final response");
    const response = await llm.invoke(prompt);
    return { messages: [response] };
  }

  // Add logging to the toolsCondition to debug
  const myToolsCondition = (state: typeof MessagesAnnotation.State) => {
    const result = toolsCondition(state);
    console.log("Tools condition result:", result);
    return result;
  };

  const queryContextCondition = (state: typeof MessagesAnnotation.State) => {
    const lastMessage =
      state.messages[state.messages.length - 1] || state.messages[0];

    // If the message has tool calls, go to tools
    if (
      lastMessage instanceof AIMessage &&
      lastMessage?.tool_calls &&
      lastMessage?.tool_calls?.length > 0
    ) {
      console.log("QueryContext condition result: tools");
      return "tools";
    }

    // If the message says "CONTEXT_GOOD", go to generate
    if (
      lastMessage instanceof AIMessage &&
      typeof lastMessage.content === "string" &&
      lastMessage.content.includes("CONTEXT_GOOD")
    ) {
      console.log("QueryContext condition result: generate");
      return "generate";
    }

    // Default case - if no tool calls and no CONTEXT_GOOD, still go to generate
    console.log("QueryContext condition result: generate (default)");
    return "generate";
  };

  const graphBuilder = new StateGraph(MessagesAnnotation)
    .addNode("queryOrRespond", queryOrRespond)
    .addNode("tools", tools)
    .addNode("queryContext", queryContext)
    .addNode("generate", generate)
    .addEdge("__start__", "queryOrRespond")
    .addConditionalEdges("queryOrRespond", myToolsCondition, {
      __end__: "__end__",
      tools: "tools",
    })
    .addEdge("tools", "queryContext") // Always go to queryContext after tools
    .addConditionalEdges("queryContext", queryContextCondition, {
      generate: "generate", // If context is good, go to generate
      tools: "tools", // If it needs more info, go back to tools
    })
    .addEdge("generate", "__end__");

  // specify a checkpointer before compiling
  // Checkpoint is a snapshot of the graph state saved at each super-step
  const checkpointMemory = new MemorySaver();
  const graphWithMemory = graphBuilder.compile({
    checkpointer: checkpointMemory,
  });

  return graphWithMemory;
};

export const answerQuestion: (
  question: string,
  threadId: string
) => Promise<{
  answer: string;
  threadId: string;
}> = async (question: string, threadId: string) => {
  let inputs = { messages: [{ role: "user", content: question }] };
  let newThreadId = threadId || uuidv4();

  if (!resGraph) {
    resGraph = await createGraph();
  }

  let response: string;
  try {
    response = await exportLastAIMsg(resGraph, inputs, newThreadId);
  } catch (error) {
    console.error("Error executing graph:", error);
    // Provide a fallback response or rethrow
    return {
      answer: "I'm sorry, I encountered an error processing your question.",
      threadId: newThreadId,
    };
  }
  console.log("✅ Vector store initialized successfully with FAQs.");

  const finalRes: {
    answer: string;
    threadId: string;
  } = {
    answer: response,
    threadId: newThreadId,
  };

  return finalRes;
};

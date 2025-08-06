import { MistralAIEmbeddings } from "@langchain/mistralai";
import { ChatGroq } from "@langchain/groq";
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
const llm = new ChatGroq({
  model: "llama-3.3-70b-versatile",
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
  console.log("✅ Vector store initialized successfully with hotel FAQs.");

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
        const retrievedDocs = await vectorStore!.similaritySearch(query, 2);
        const serialized = retrievedDocs
          .map(
            (doc) =>
              `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`
          )
          .join("\n");
        return serialized || "No relevant information found.";
      } catch (error) {
        console.error("Error in retrieve tool:", error);
        return "Error retrieving documents.";
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
  // if the LLM decides to use the retrieval tool, it will return an AI message with tool calls that the ToolNode will execute with the retrieve function
  // if not, it will return an AI message with the response
  async function queryOrRespond(state: typeof MessagesAnnotation.State) {
    const llmWithTools = llm.bindTools([retrieve, tavilySearch]); // tells the LLM about available tools

    // Add system message with clear instructions,
    // enabling the LLM to decide whether to call a tool or respond directly
    const systemMessage = new SystemMessage(
      "You are a helpful hotel assistant with access to two tools:\n" +
        "1. 'retrieve' - Use this for questions related to OSCA fest (schedule, events, activities, etc.)\n" +
        "2. 'tavily_search' - Use this for general information, current events, weather, local attractions, etc.\n" +
        "When asked a question, ALWAYS choose the most appropriate tool based on the question type. " +
        "For OSCA fest-related questions, use 'retrieve' first. For general questions, use 'tavily_search'. \n" +
        "Formulate a search query based on the user's question."
    );

    // Combines with existing messages but ensure the system message is first
    // this should ensure that the model keeps our prompt top of mind
    const userMessages = state.messages.filter(
      (msg) => msg instanceof HumanMessage || msg instanceof AIMessage
    );

    const messagesWithSystem = [systemMessage, ...userMessages];

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

  // Generates a response using the retrieved content.
  // i.e. combines the user's query with the retrieved content, sends this to the LLM and returns the response
  async function generate(state: typeof MessagesAnnotation.State) {
    let recentToolMessages = [];
    for (let i = state["messages"].length - 1; i >= 0; i--) {
      let message = state["messages"][i];
      if (message instanceof ToolMessage) {
        recentToolMessages.push(message);
      } else {
        break;
      }
    }
    let toolMessages = recentToolMessages.reverse();

    // Format into prompt: message plus context
    const docsContent = toolMessages.map((doc) => doc.content).join("\n");
    const systemMessageContent =
      "You are a knowledgeable and very helpful assistant with access to a list of FAQs." +
      "Use the following pieces of retrieved context to answer " +
      "the question. If you don't know the answer, just say that you " +
      "don't know, don't try to make up an answer." +
      "Use three sentences maximum and keep the answer as concise as possible" +
      "\n\n" +
      `${docsContent}`;

    // get all messages relevant to the conversation from the state, i.e. no AI messages with tool calls
    // this way we have a list of messages that are relevant to the conversation
    const conversationMessages = state.messages.filter(
      (message) =>
        message instanceof HumanMessage ||
        message instanceof SystemMessage ||
        (message instanceof AIMessage && message.tool_calls?.length == 0)
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
    const response = await llm.invoke(prompt);
    return { messages: [response] };
  }

  // Add logging to the toolsCondition to debug
  const myToolsCondition = (state: typeof MessagesAnnotation.State) => {
    const result = toolsCondition(state);
    console.log("Tools condition result:", result);

    //     Tools condition result: tools
    // [ai]:
    // Tools:
    // - retrieve({"query":"hotel check-in time"})

    return result;
  };

  const graphBuilder = new StateGraph(MessagesAnnotation)
    .addNode("queryOrRespond", queryOrRespond)
    .addNode("tools", tools)
    .addNode("generate", generate)
    .addEdge("__start__", "queryOrRespond")
    .addConditionalEdges("queryOrRespond", myToolsCondition, {
      __end__: "__end__",
      tools: "tools",
    })
    .addEdge("tools", "generate")
    .addEdge("generate", "__end__");

  // specify a checkpointer before compiling
  // Checkpoint is a snapshot of the graph state saved at each super-step
  const checkpointMemory = new MemorySaver();
  const graphWithMemory = graphBuilder.compile({
    checkpointer: checkpointMemory,
  });

  return graphWithMemory;
};

export const answerQuestion = async (question: string, threadId?: string) => {
  let inputs = { messages: [{ role: "user", content: question }] };
  let newThreadId = threadId ?? uuidv4();

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
    };
  }

  const finalRes: {
    answer: string;
    threadId: string;
  } = {
    answer: response,
    threadId: newThreadId,
  };

  return finalRes;
};

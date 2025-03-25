import { MistralAIEmbeddings } from "@langchain/mistralai";
import { ChatGroq } from "@langchain/groq";
import {
  MemorySaver,
  MessagesAnnotation,
  StateGraph,
} from "@langchain/langgraph";
import { splitDocs } from "../utils/splitDocs";
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
// import { logAIConversation } from "../utils/extractFinalAIResponse";
import { v4 as uuidv4 } from "uuid";
import { exportLastAIMsg } from "../utils/extractFinalAIResponse";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

const llm = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0,
});

// Instantiate Mistral AI embedding model
const embeddings = new MistralAIEmbeddings({
  model: "mistral-embed",
});

// Store vector DB in memory
let vectorStore: MemoryVectorStore | null = null;

// Store Graph in memory
let resGraph: any = null;

// initialize FAQs
// create Vector store
export const initFAQs = async () => {
  if (vectorStore) return vectorStore; // Prevent reloading if already initialized
  console.log("default vector store", vectorStore);

  const chunks = await splitDocs("FAQs.docx");

  console.log("🟢 Initializing vector store...");

  // Initialise vector store
  console.log("✅ Vector store initialized with hotel FAQs.");

  vectorStore = new MemoryVectorStore(embeddings);

  await vectorStore.addDocuments(chunks);

  if (vectorStore == undefined || vectorStore == null) {
    console.warn("⚠ Vector store creation failed");
  }
  console.log("Initialized vector store successfully.");

  return vectorStore;
};

// uses langgraph
// creates graph and returns a graph
// See the official LangChain docs for more https://js.langchain.com/docs/tutorials/qa_chat_history/
export const createGraph = async () => {
  if (!vectorStore) {
    console.warn("⚠ Vector store not initialized, initializing now...");
    await initFAQs();
  }

  // USING LangGraph

  // Retriever as a langchain tool
  // this allows the model to rewrite user queries into more effective search queries
  const retrieveSchema = z.object({ query: z.string() });

  // this converts the retriever function into a tool that must return a query
  const retrieve = tool(
    // the JS function to be converted
    async ({ query }) => {
      try {
        const retrievedDocs = await vectorStore!.similaritySearch(query, 2);
        const serialized = retrievedDocs
          .map(
            (doc) =>
              `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`
          )
          .join("\n");
        return [serialized || "No relevant information found.", retrievedDocs];
      } catch (error) {
        console.error("Error in retrieve tool:", error);
        return "Error retrieving documents.";
      }
    },
    {
      name: "retrieve",
      description: "Retrieve information related to a query.",
      schema: retrieveSchema,
      responseFormat: "content_and_artifact",
    }
  );

  // Function to generate AI Message that may include a tool-call to be sent.
  async function queryOrRespond(state: typeof MessagesAnnotation.State) {
    const llmWithTools = llm.bindTools([retrieve]);

    // Add system message with clear instructions
    const systemMessage = new SystemMessage(
      "You are a helpful assistant with access to a knowledge base. " +
        "When asked a question, ALWAYS use the 'retrieve' tool first to search for relevant information " +
        "before attempting to answer. Formulate a search query based on the user's question."
    );

    // Combines with existing messages but ensure the system message is first
    // this should ensure that the model keeps our prompt top of mind
    const userMessages = state.messages.filter(
      (msg) => msg instanceof HumanMessage || msg instanceof AIMessage
    );

    const messagesWithSystem = [systemMessage, ...userMessages];
    // console.log("Messages sent to LLM:", messagesWithSystem);

    // trims to the last 80 tokens
    const trimmer = trimMessages({
      maxTokens: 80,
      strategy: "last",
      tokenCounter: (msgs) => msgs.length,
      includeSystem: true,
      allowPartial: false,
      startOn: "human",
    });

    const trimmedMessages = await trimmer.invoke(messagesWithSystem);

    const response = await llmWithTools.invoke(trimmedMessages);

    // console.log("Model response:", response);

    // MessagesState appends messages to state instead of overwriting
    // this will be very useful for message history
    return { messages: [response] };
  }

  // Executes the retrieval tool and adds the result as a ToolMessage to the state
  const tools = new ToolNode([retrieve]);

  // Generate a response using the retrieved content.
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

    // Run
    const response = await llm.invoke(prompt);
    return { messages: [response] };
  }

  // Add logging to the toolsCondition to debug
  const myToolsCondition = (state: typeof MessagesAnnotation.State) => {
    const result = toolsCondition(state);
    console.log("Tools condition result:", result);
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
  // remember that messages are not being overwritten by the nodes, just appended
  // this means we can retain a consistent chat history across invocations
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

  console.log("newThread", newThreadId);

  // is it sensible to create a graph each time?
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

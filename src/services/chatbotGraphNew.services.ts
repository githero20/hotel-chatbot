import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChatMistralAI, MistralAIEmbeddings } from "@langchain/mistralai";
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
} from "@langchain/core/messages";
// import { logAIConversation } from "../utils/extractFinalAIResponse";
import { v4 as uuidv4 } from "uuid";

// Instantiate the model
const llm = new ChatMistralAI({
  model: "mistral-large-latest",
  temperature: 0.2,
});

// Instantiate Mistral AI embedding model
const embeddings = new MistralAIEmbeddings({
  model: "mistral-embed",
});

// Store vector DB in memory
let vectorStore: Chroma | null = null;

// Store Graph in memory
let resGraph: any = null;

// export const createChromaVectorStore = () => {
//   const vectorStore = new Chroma(embeddings, {
//     collectionName: "a-test-collection",
//     url: ChromaDbUrl, // Connect to the running Chroma instance
//     collectionMetadata: {
//       "hnsw:space": "cosine",
//     }, // Optional, used to specify the distance method of the embedding space https://docs.trychroma.com/usage-guide#changing-the-distance-function
//   });

//   return vectorStore;
// };

const ChromaDbUrl = process.env.CHROMA_URL || "http://localhost:8000";

// initialize FAQs
// create Vector store
export const initFAQs = async () => {
  if (vectorStore) return vectorStore; // Prevent reloading if already initialized
  console.log("default vector store", vectorStore);

  const chunks = await splitDocs("FAQs.docx");

  console.log("🟢 Initializing vector store...");

  // Initialise vector store
  vectorStore = await Chroma.fromDocuments(chunks, embeddings, {
    collectionName: "chat-collection-ai2",
    url: ChromaDbUrl, // Connect to the running Chroma instance
    collectionMetadata: {
      "hnsw:space": "cosine",
    }, // Optional, used to specify the distance method of the embedding space https://docs.trychroma.com/usage-guide#changing-the-distance-function
  });
  console.log("✅ ChromaDB initialized with hotel FAQs.");

  // await vectorStore.addDocuments(splitDocs);
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
      const retrievedDocs = await vectorStore!.similaritySearch(query, 2);
      const serialized = retrievedDocs
        .map(
          (doc) => `Source: ${doc.metadata.source}\nContent: ${doc.pageContent}`
        )
        .join("\n");
      return [serialized, retrievedDocs];
    },
    {
      name: "retrieve",
      description: "Retrieve information related to a query.",
      schema: retrieveSchema,
      responseFormat: "content_and_artifact",
    }
  );

  // Function to generate AI Message that may include a tool-call to be sent.
  // 1. Update the queryOrRespond function to provide clear instructions
  async function queryOrRespond(state: typeof MessagesAnnotation.State) {
    const llmWithTools = llm.bindTools([retrieve]);

    // Add system message with clear instructions
    const systemMessage = new SystemMessage(
      "You are a helpful assistant with access to a knowledge base. " +
        "When asked a question, ALWAYS use the 'retrieve' tool first to search for relevant information " +
        "before attempting to answer. Formulate a search query based on the user's question."
    );

    // Combine with existing messages but ensure the system message is first
    const userMessages = state.messages.filter(
      (msg) => msg instanceof HumanMessage || msg instanceof AIMessage
    );

    const messagesWithSystem = [systemMessage, ...userMessages];
    console.log("Messages sent to LLM:", messagesWithSystem);

    const response = await llmWithTools.invoke(messagesWithSystem);
    // const response = await llmWithTools.invoke(state.messages);
    // console.log("Model response:", response);

    // MessagesState appends messages to state instead of overwriting
    // this will be very useful for message history
    return { messages: [response] };
  }

  // Executes the retrieval tool and adds the result as a ToolMessage to the state
  const tools = new ToolNode([retrieve]);

  // Generate a response using the retrieved content.
  async function generate(state: typeof MessagesAnnotation.State) {
    // Get generated ToolMessages
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

    // Format into prompt
    const docsContent = toolMessages.map((doc) => doc.content).join("\n");
    const systemMessageContent =
      "You are a knowledgeable assistant for answering user questions. " +
      "Use the following pieces of retrieved context to answer " +
      "the question. If you don't know the answer, just say that you " +
      "don't know, don't try to make up an answer." +
      "Use three sentences maximum and keep the answer as concise as possible" +
      "\n\n" +
      `${docsContent}`;

    // get all messages relevant to the conversation from the state
    const conversationMessages = state.messages.filter(
      (message) =>
        message instanceof HumanMessage ||
        message instanceof SystemMessage ||
        (message instanceof AIMessage && message.tool_calls?.length == 0)
    );
    const prompt = [
      new SystemMessage(systemMessageContent),
      ...conversationMessages,
    ];

    // Run
    const response = await llm.invoke(prompt);
    return { messages: [response] };
  }

  // // 2. Add logging to the toolsCondition to debug
  // const myToolsCondition = (state: typeof MessagesAnnotation.State) => {
  //   const result = toolsCondition(state);
  //   console.log("Tools condition result:", result);
  //   return result;
  // };

  const graphBuilder = new StateGraph(MessagesAnnotation)
    .addNode("queryOrRespond", queryOrRespond)
    .addNode("tools", tools)
    .addNode("generate", generate)
    .addEdge("__start__", "queryOrRespond")
    .addConditionalEdges("queryOrRespond", toolsCondition, {
      __end__: "__end__",
      tools: "tools",
    })
    .addEdge("tools", "generate")
    .addEdge("generate", "__end__");

  // specify a checkpointer before compiling
  // remember that messages are not being overwritten by the nodes, just appended
  // this means we can retain a consistent chat history across invocations
  // Checkpoint is a snapshot of the graph state saved at each super-step
  const checkpointer = new MemorySaver();
  const graphWithMemory = graphBuilder.compile({ checkpointer });

  return graphWithMemory;
};

export const answerQuestion = async (question: string, threadId?: string) => {
  let inputs = { messages: [{ role: "user", content: question }] }; // same as {question: question}

  let newThreadId = threadId ?? uuidv4();

  // you can also save user_id with memory store
  let config = { configurable: { thread_id: newThreadId } };

  console.log("newThread", newThreadId);

  // is it sensible to create a graph each time?
  if (!resGraph) {
    resGraph = await createGraph();
  }

  let response;
  try {
    response = await resGraph.invoke(inputs, config);
  } catch (error) {
    console.error("Error executing graph:", error);
    // Provide a fallback response or rethrow
    return new AIMessage(
      "I'm sorry, I encountered an error processing your question."
    );
  }

  // logs the graph conversation in console
  // can be used to see how the query is rewritten before being sent to the llm
  // and also what relevant content is extracted and how it is used
  // await logAIConversation(resGraph, inputs, newThreadId);

  // return response;
  return response.messages[response.messages.length - 1]?.lc_kwargs?.content;
};

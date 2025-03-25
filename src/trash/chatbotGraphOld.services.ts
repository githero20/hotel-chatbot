import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { faqLoader } from "../utils/faqLoader";
import { ChatMistralAI, MistralAIEmbeddings } from "@langchain/mistralai";
import { Annotation, StateGraph } from "@langchain/langgraph";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const llm = new ChatMistralAI({
  model: "mistral-large-latest",
  temperature: 0.2,
});

// Store vector DB in memory
let vectorStore: Chroma | null = null;

const ChromaDbUrl = process.env.CHROMA_URL || "http://localhost:8000";

// initialize FAQs and create Vector store
export const initFAQs = async () => {
  if (vectorStore) return vectorStore; // Prevent reloading if already initialized
  console.log("default vector store", vectorStore);

  // Load the data
  const loadedDocs = await faqLoader("FAQs.docx");

  // create your splitter
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  //  split the docs into chunks
  const splitDocs = await textSplitter.splitDocuments(loadedDocs);

  // Instantiate Hugging Face embeddings class
  const embeddings = new MistralAIEmbeddings({
    model: "mistral-embed",
  });

  /**
   * Next, we instantiate a vector store. This is where we store the embeddings of the documents.
   * We also need to provide an embeddings object. This is used to embed the documents.
   */
  console.log("🟢 Initializing vector store...");
  vectorStore = await Chroma.fromDocuments(splitDocs, embeddings, {
    collectionName: "chat-collection-ai",
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
  console.log("Initialized vector store");

  return vectorStore;
};

// uses langgraph
// creates graph and returns a graph
export const createGraph = async (question: string) => {
  if (!vectorStore) {
    console.warn("⚠ Vector store not initialized, initializing now...");
    await initFAQs();
  }

  // // Define application steps
  // const retrieve = async (state: typeof InputStateAnnotation.State) => {
  //   const retrievedDocs = await vectorStore.similaritySearch(state.question);
  //   return { context: retrievedDocs };
  // };

  // Build Chat prompt template
  const promptTemplate = ChatPromptTemplate.fromTemplate(
    `Use the following pieces of context to answer the question at the end.
  If you don't know the answer, just say that you don't know, don't try to make up an answer.
  Use three sentences maximum and keep the answer as concise as possible.
  
  {context}
  
  Question: {question}
  
  Helpful Answer:`
  );

  // USING LangGraph
  // Define state for application
  // const InputStateAnnotation = Annotation.Root({
  //   question: Annotation<string>,
  // });

  const StateAnnotation = Annotation.Root({
    question: Annotation<string>,
    context: Annotation<Document[]>,
    answer: Annotation<string>,
  });

  // retrieves from a Chroma store
  const retrieve = async () => {
    // create data retriever:
    const retriever = vectorStore!.asRetriever({
      k: 2,
      searchType: "similarity",
    });
    // get relevant documents:
    const results = await retriever.invoke(question);
    // return the docs themselves
    // const resultDocs = results.map((res) => res.pageContent);

    // if (!results) {
    //   throw new Error(
    //     "Context is empty. Ensure the retriever is returning results."
    //   );
    // }

    return { context: results };
    // return { context: results, perDocs: resultDocs };
  };

  const generate = async (state: typeof StateAnnotation.State) => {
    const docsContent = state.context
      .map((doc: any) => doc.pageContent)
      .join("\n");
    const messages = await promptTemplate.invoke({
      question: state.question,
      context: docsContent,
    });
    const response = await llm.invoke(messages);
    return { answer: response.content };
  };

  // Compile application and test
  const graph = new StateGraph(StateAnnotation)
    .addNode("retrieve", retrieve)
    .addNode("generate", generate)
    .addEdge("__start__", "retrieve")
    .addEdge("retrieve", "generate")
    .addEdge("generate", "__end__")
    .compile();

  return graph;
};

export const answerQuestion = async (question: string) => {
  let inputs = { question }; // same as {question: question}

  const resGraph = await createGraph(question);
  const response = await resGraph.invoke(inputs);

  return response.answer;
};

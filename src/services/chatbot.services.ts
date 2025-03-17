import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatMistralAI, MistralAIEmbeddings } from "@langchain/mistralai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { faqLoader } from "../utils/faqLoader";

const llm = new ChatMistralAI({
  model: "mistral-large-latest",
  temperature: 0.2,
});

// Store vector DB in memory
let vectorStore: Chroma | null = null;

const ChromaDbUrl = process.env.CHROMA_URL || "http://localhost:8000";

// initialize FAQs
export const initFAQs = async () => {
  if (vectorStore) return vectorStore; // Prevent reloading if already initialized
  console.log("default vector store", vectorStore);

  const loadedDocs = await faqLoader("FAQs.docx");

  // create your splitter
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  /**  split the docs into chunks*/
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
    }, // Optional, can be used to specify the distance method of the embedding space https://docs.trychroma.com/usage-guide#changing-the-distance-function
  });
  console.log("✅ ChromaDB initialized with hotel FAQs.");

  // this is failing
  // await vectorStore.addDocuments(splitDocs);
  if (vectorStore == undefined || vectorStore == null) {
    console.warn("⚠ Vector store creation failed");
  }
  console.log("Initialized vector store");

  return vectorStore;
};

export const answerQuestion = async (question: string) => {
  if (!vectorStore) {
    console.warn("⚠ Vector store not initialized, initializing now...");
    await initFAQs();
  }

  // create data retriever:
  const retriever = vectorStore!.asRetriever({
    k: 2,
    searchType: "similarity",
  });

  // get relevant documents:
  const results = await retriever.invoke(question);
  // return the docs themselves
  const resultDocs = results.map((res) => res.pageContent);

  if (!resultDocs) {
    throw new Error(
      "Context is empty. Ensure the retriever is returning results."
    );
  }

  // build template
  const promptTemplate = ChatPromptTemplate.fromTemplate(
    `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Use three sentences maximum and keep the answer as concise as possible.

{context}

Question: {question}

Helpful Answer:`
  );
  const parser = new StringOutputParser();

  const chain = promptTemplate.pipe(llm).pipe(parser);

  const responseText: any = await chain.invoke({
    context: resultDocs,
    question: question,
  });

  return responseText;
};

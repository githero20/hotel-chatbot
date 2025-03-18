import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
import { ChatMistralAI, MistralAIEmbeddings } from "@langchain/mistralai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { faqLoader } from "../utils/faqLoader";
import {
  Runnable,
  RunnableConfig,
  RunnablePassthrough,
  RunnableSequence,
  // RunnableWithMessageHistory,
} from "@langchain/core/runnables";
import { formatDocumentsAsString } from "langchain/util/document";
// import { UpstashRedisChatMessageHistory } from "@langchain/community/stores/message/upstash_redis";

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

// receives a question checks if it makes reference to chat history
// then creates a sub-chain that contextualizes that question with respect to the chat history
export const createContextualChain = () => {
  const contextualizeSystemPrompt = `Given a chat history and the latest user question
which might reference context in the chat history, formulate a standalone question
which can be understood without the chat history. Do NOT answer the question,
just reformulate it if needed and otherwise return it as is.`;

  const contextualizePrompt = ChatPromptTemplate.fromMessages([
    ["system", contextualizeSystemPrompt],
    new MessagesPlaceholder("chat_history"),
    ["human", "{question}"],
  ]);
  const contextualizeChain = contextualizePrompt
    .pipe(llm)
    .pipe(new StringOutputParser());

  return contextualizeChain;
};

// creates chain and returns a response based on chat history
export const createChainWithHistory = async (question: string) => {
  if (!vectorStore) {
    console.warn("⚠ Vector store not initialized, initializing now...");
    await initFAQs();
  }

  const qaSystemPrompt = `You are an assistant for question-answering tasks.
Use the following pieces of retrieved context to answer the question.
If you don't know the answer, just say that you don't know.
Use three sentences maximum and keep the answer concise.

{context}`;

  const qaPrompt = ChatPromptTemplate.fromMessages([
    ["system", qaSystemPrompt],
    new MessagesPlaceholder("chat_history"), // adds chat history to the prompt
    ["human", "{question}"],
  ]);

  // use contextualize chain only when chat_history is passed in the prompt
  // returns a properly contextualized question
  const contextualizedQuestion = (input: Record<string, unknown>) => {
    if ("chat_history" in input) {
      return createContextualChain(); // return contextual chain
    }
    return input.question;
  };

  // If a function in an LCEL chain returns another chain, that chain will itself be invoked
  // creates a chain with context from past chat history
  const ragChain = RunnableSequence.from([
    RunnablePassthrough.assign({
      context: async (input: Record<string, unknown>) => {
        if ("chat_history" in input) {
          const chain = contextualizedQuestion(input) as Runnable<
            any,
            string,
            RunnableConfig<Record<string, any>>
          >;
          return chain.pipe(retriever).pipe(formatDocumentsAsString);
        }
        return "";
      },
    }),
    qaPrompt,
    llm,
  ]);

  let chat_history = [];

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

  // const chain = await createStuffDocumentsChain({
  //   llm,
  //   promptTemplate,
  //   parser
  // })

  const chain = promptTemplate.pipe(llm).pipe(parser);

  const responseText = await chain.invoke({
    context: resultDocs,
    question: question,
  });

  return responseText;
};

// const createChainWithHistoryNew = async (question: string) => {
//   if (!vectorStore) {
//     console.warn("⚠ Vector store not initialized, initializing now...");
//     await initFAQs();
//   }

//   // create data retriever:
//   const retriever = vectorStore!.asRetriever({
//     k: 2,
//     searchType: "similarity",
//   });

//   // get relevant documents:
//   const results = await retriever.invoke(question);
//   // return the docs themselves
//   const resultDocs = results.map((res) => res.pageContent);

//   if (!resultDocs) {
//     throw new Error(
//       "Context is empty. Ensure the retriever is returning results."
//     );
//   }

//   // build template
//   //   const promptTemplate = ChatPromptTemplate.fromTemplate(
//   //     `Use the following pieces of context to answer the question at the end.
//   // If you don't know the answer, just say that you don't know, don't try to make up an answer.
//   // Use three sentences maximum and keep the answer as concise as possible.
//   // {context}
//   // Chat History: {history}
//   // Question: {question}
//   // Helpful Answer:`
//   //   );

//   const promptTemplate = ChatPromptTemplate.fromMessages([
//     [
//       "system",
//       `Use the following pieces of context to answer the question at the end.
// If you don't know the answer, just say that you don't know, don't try to make up an answer.
// Use three sentences maximum and keep the answer as concise as possible {context}`,
//     ],
//     new MessagesPlaceholder("history"),
//     ["user", "{question}"],
//   ]);

//   const parser = new StringOutputParser();

//   const upstashMessageHistory = new UpstashRedisChatMessageHistory({
//     sessionId: "mysession",
//     config: {
//       url: process.env.UPSTASH_REDIS_URL,
//       token: process.env.UPSTASH_REST_TOKEN,
//     },
//   });

//   // const chain = await createStuffDocumentsChain({
//   //   llm,
//   //   promptTemplate,
//   //   parser
//   // })

//   const chain = promptTemplate.pipe(llm).pipe(parser);

//   // Adding Message History to our chain
//   // Using LCEL

//   const chainWithHistory = new RunnableWithMessageHistory({
//     runnable: chain,
//     getMessageHistory: (sessionId) =>
//       new UpstashRedisChatMessageHistory({
//         sessionId,
//         config: {
//           url: process.env.UPSTASH_REDIS_REST_URL!,
//           token: process.env.UPSTASH_REDIS_REST_TOKEN!,
//         },
//       }),
//     inputMessagesKey: "question",
//     historyMessagesKey: "history",
//   });

//   const responseText = await chainWithHistory.invoke(
//     {
//       context: resultDocs,
//       question: question,
//     },
//     {
//       configurable: {
//         sessionId: "foobarbaz",
//       },
//     }
//   );

//   // const responseText = await chain.invoke({
//   //   context: resultDocs,
//   //   question: question,
//   // });

//   return responseText;
// };

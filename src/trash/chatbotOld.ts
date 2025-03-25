import { faqLoader } from "../utils/faqLoader";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { ChatPromptTemplate } from "@langchain/core/prompts";
// import HuggingFaceEmbeddings from "./utils/HuggingFaceEmbeddings";
import { RunnableLambda } from "@langchain/core/runnables";
import { HfInference } from "@huggingface/inference";
import { Embeddings } from "@langchain/core/embeddings";
import { ChatPromptValue } from "@langchain/core/prompt_values";
import { StringOutputParser } from "@langchain/core/output_parsers";

const inference = new HfInference(process.env.HF_TOKEN);

/** Create a custom embeddings class implementing LangChain's Embeddings interface */
class HuggingFaceEmbeddings extends Embeddings {
  constructor() {
    super({}); // Call super with an empty object (LangChain requires it)
  }

  async embedQuery(text: string): Promise<number[]> {
    const output = await inference.featureExtraction({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      inputs: text,
    });
    return output as number[];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embedQuery(text)));
  }
}

// Load FAQs from Docx file
export const initFAQs = async () => {
  const loadedDocs = await faqLoader("FAQs.docx");

  // create your splitter
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 100,
  });

  /**  split the docs into chunks*/
  const splitDocs = await textSplitter.splitDocuments(loadedDocs);

  // Instantiate Hugging Face embeddings class
  const embeddings = new HuggingFaceEmbeddings();

  /**
   * Next, we instantiate a vector store. This is where we store the embeddings of the documents.
   * We also need to provide an embeddings object. This is used to embed the documents.
   */
  const vectorStore = await Chroma.fromDocuments(splitDocs, embeddings, {
    collectionName: "chat-collection",
    url: "http://localhost:8000", // Connect to the running Chroma instance
  });
  console.log("✅ ChromaDB initialized with hotel FAQs.");
  // await vectorStore.addDocuments(splitDocs);

  return vectorStore;
};

export const answerQuestion = async (question: string, vectorStore: Chroma) => {
  // create data retriever:
  const retriever = vectorStore.asRetriever({
    k: 2,
    searchType: "similarity",
  });

  // get relevant documents:
  const results = await retriever.invoke(question);
  // return the docs themselves
  const resultDocs = results.map((res) => res.pageContent);

  const formattedContext = resultDocs.join("\n\n"); // Combine retrieved FAQs into a clear format

  if (!formattedContext) {
    throw new Error(
      "Context is empty. Ensure the retriever is returning results."
    );
  }

  // Define a Hugging Face model as a Runnable function
  const huggingFaceModel = new RunnableLambda({
    func: async (input: ChatPromptValue) => {
      // Extract string from ChatPromptValueInterface
      const inputText = input.toString(); // Converts ChatPromptValue to plain string

      const response = await inference.textGeneration({
        model: "HuggingFaceH4/zephyr-7b-alpha",
        inputs: inputText,
        parameters: {
          max_new_tokens: 80,
          temperature: 0.9,
        },
      });
      return response.generated_text.trim();
    },
  });

  // const chain = promptTemplate.pipe(huggingFaceModel);

  // const response: any = await chain.invoke({
  //   question: question,
  //   context: resultDocs,
  // });

  // build template
  // const promptTemplate = ChatPromptTemplate.fromMessages([
  //   [
  //     "system",
  //     `You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.
  //       Question: {input}
  //       Context: {context}
  //       Answer:`,
  //   ],
  //   ["user", "{input}"],
  // ]);

  const promptTemplate = ChatPromptTemplate.fromTemplate(
    `Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Use three sentences maximum and keep the answer as concise as possible.
Always say "thanks for asking!" at the end of the answer.

{context}

Question: {question}

Helpful Answer:`
  );
  const parser = new StringOutputParser();

  // return response.content;
  const chain = promptTemplate.pipe(huggingFaceModel).pipe(parser);

  // const formattedInput = `Context: ${formattedContext}\n\nQuestion: ${question}\n\nAnswer:`;

  const responseText: any = await chain.invoke({
    question: question,
    context: formattedContext, // formatted FAQs
  });

  // return response
  //   .replace(/^.*?Human:/s, "") // Remove everything before "AI:"
  //   .trim();
  const cleanResponse =
    responseText
      .split("AI:")[1] // Keep only the part after "AI:"
      ?.trim() || responseText.trim(); // Fallback in case there's no "AI:" prefix

  return cleanResponse;
};

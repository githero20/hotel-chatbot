import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { faqLoader } from "./faqLoader";

// function to split loaded docs into chunks
export const splitDocs = async (filePath: string) => {
  // Load the data
  const loadedDocs = await faqLoader(filePath);

  // create your splitter
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  //  split the docs into chunks
  const chunks = await textSplitter.splitDocuments(loadedDocs);

  return chunks;
};

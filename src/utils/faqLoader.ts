import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { Document } from "@langchain/core/documents";

// function to load content from .docx file
export const faqLoader: (
  absoluteFilePath: string
) => Promise<Document<Record<string, any>>[]> = async (
  absoluteFilePath: string
) => {
  const loader = new DocxLoader(absoluteFilePath);
  const docs = await loader.load();
  return docs;
};

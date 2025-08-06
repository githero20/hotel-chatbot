import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { Document } from "@langchain/core/documents";
import path from "path";

// Function that detects file type and uses appropriate loader
export const faqLoader = async (
  absoluteFilePath: string
): Promise<Document<Record<string, any>>[]> => {
  const fileExtension = path.extname(absoluteFilePath).toLowerCase();

  let loader;

  switch (fileExtension) {
    case ".docx":
      loader = new DocxLoader(absoluteFilePath);
      break;

    case ".pdf":
      loader = new PDFLoader(absoluteFilePath);
      break;

    case ".csv":
      loader = new CSVLoader(absoluteFilePath);
      break;

    case ".txt":
    case ".md":
    case ".markdown":
      loader = new TextLoader(absoluteFilePath);
      break;

    default:
      throw new Error(
        `Unsupported file type: ${fileExtension}. ` +
          `Supported types: .docx, .pdf, .csv, .txt, .md, .markdown`
      );
  }

  try {
    const docs = await loader.load();
    console.log(
      `✅ Successfully loaded ${docs.length} documents from ${fileExtension} file`
    );
    return docs;
  } catch (error) {
    console.error(`❌ Error loading file ${absoluteFilePath}:`, error);
    throw new Error(`Failed to load file: ${error}`);
  }
};

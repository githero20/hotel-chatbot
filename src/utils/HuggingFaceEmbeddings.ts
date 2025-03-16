import { HfInference } from "@huggingface/inference";
import { Embeddings } from "@langchain/core/embeddings";

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

// /** Generate embeddings per text */
// const getEmbeddings = async (textToEmbed: string): Promise<number[]> => {
//   const output = await inference.featureExtraction({
//     // Use a suitable embedding model
//     model: "sentence-transformers/all-MiniLM-L6-v2",
//     inputs: textToEmbed,
//   });

//   return output as number[];
// };
export default HuggingFaceEmbeddings;

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import { GoogleGenAI, GenerateContentResponse, Tool, HarmCategory, HarmBlockThreshold, Content, FunctionDeclaration, Type } from "@google/genai";
import { UrlContextMetadataItem, Document } from '../types';

// ... (getAiInstance, safetySettings, GeminiResponse remain the same)

const KB_MANAGEMENT_TOOLS: FunctionDeclaration[] = [
  {
    name: "listKnowledgeBase",
    description: "List all URLs and documents in the current knowledge base.",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "addUrl",
    description: "Add a URL to the knowledge base.",
    parameters: {
      type: Type.OBJECT,
      properties: { url: { type: Type.STRING, description: "The URL to add." } },
      required: ["url"]
    }
  },
  {
    name: "removeUrl",
    description: "Remove a URL from the knowledge base.",
    parameters: {
      type: Type.OBJECT,
      properties: { url: { type: Type.STRING, description: "The URL to remove." } },
      required: ["url"]
    }
  },
  {
    name: "saveMemory",
    description: "Save a text note or memory to the knowledge base. Use this when the user asks you to remember something.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        title: { type: Type.STRING, description: "A short title for the memory." },
        content: { type: Type.STRING, description: "The content of the memory to save." }
      },
      required: ["title", "content"]
    }
  }
];

// IMPORTANT: The API key MUST be set as an environment variable `process.env.API_KEY`
const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI;

// Model supporting URL context, consistent with user examples and documentation.
const MODEL_NAME = "gemini-2.5-flash"; 

const getAiInstance = (): GoogleGenAI => {
  if (!API_KEY) {
    console.error("API_KEY is not set in environment variables. Please set process.env.API_KEY.");
    throw new Error("Gemini API Key not configured. Set process.env.API_KEY.");
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return ai;
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

interface GeminiResponse {
  text: string;
  urlContextMetadata?: UrlContextMetadataItem[];
  functionCalls?: any[];
}

export const generateContentWithUrlContext = async (
  prompt: string,
  urls: string[],
  documents: Document[] = []
): Promise<GeminiResponse> => {
  const currentAi = getAiInstance();
  
  let fullPrompt = prompt;
  if (urls.length > 0) {
    const urlList = urls.join('\n');
    fullPrompt = `${fullPrompt}\n\nRelevant URLs for context:\n${urlList}`;
  }
  
  if (documents.length > 0) {
    const docList = documents.map(doc => `--- Document: ${doc.name} ---\n${doc.content}`).join('\n\n');
    fullPrompt = `${fullPrompt}\n\nRelevant Documents for context:\n${docList}`;
  }

  const tools: Tool[] = [{ urlContext: {} }, { functionDeclarations: KB_MANAGEMENT_TOOLS }];
  const contents: Content[] = [{ role: "user", parts: [{ text: fullPrompt }] }];

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: { 
        tools: tools,
        safetySettings: safetySettings,
        systemInstruction: "You are a helpful knowledge base assistant and memory bank. You can answer questions based on the provided URLs and Documents. If the user asks you to remember something, use the saveMemory tool to save it as a document. If they ask you to add a URL, use the addUrl tool."
      },
    });

    const text = response.text;
    const candidate = response.candidates?.[0];
    let extractedUrlContextMetadata: UrlContextMetadataItem[] | undefined = undefined;
    const functionCalls = response.functionCalls;

    if (candidate && candidate.urlContextMetadata && candidate.urlContextMetadata.urlMetadata) {
      console.log("Raw candidate.urlContextMetadata.urlMetadata from API/SDK:", JSON.stringify(candidate.urlContextMetadata.urlMetadata, null, 2));
      // Assuming SDK converts snake_case to camelCase, UrlContextMetadataItem type (now camelCase) should match items in urlMetadata.
      extractedUrlContextMetadata = candidate.urlContextMetadata.urlMetadata as UrlContextMetadataItem[];
    } else if (candidate && candidate.urlContextMetadata) {
      // This case implies urlContextMetadata exists but urlMetadata field might be missing or empty.
      console.warn("candidate.urlContextMetadata is present, but 'urlMetadata' field is missing or empty:", JSON.stringify(candidate.urlContextMetadata, null, 2));
    } else {
      // console.log("No urlContextMetadata found in the Gemini API response candidate.");
    }
    
    return { text, urlContextMetadata: extractedUrlContextMetadata, functionCalls };

  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
      const googleError = error as any; 
      if (googleError.message && googleError.message.includes("API key not valid")) {
         throw new Error("Invalid API Key. Please check your GEMINI_API_KEY environment variable.");
      }
      if (googleError.message && googleError.message.includes("quota")) {
        throw new Error("API quota exceeded. Please check your Gemini API quota.");
      }
      if (googleError.type === 'GoogleGenAIError' && googleError.message) {
        throw new Error(`Gemini API Error: ${googleError.message}`);
      }
      throw new Error(`Failed to get response from AI: ${error.message}`);
    }
    throw new Error("Failed to get response from AI due to an unknown error.");
  }
};

// This function now aims to get a JSON array of string suggestions.
export const getInitialSuggestions = async (urls: string[]): Promise<GeminiResponse> => {
  if (urls.length === 0) {
    // This case should ideally be handled by the caller, but as a fallback:
    return { text: JSON.stringify({ suggestions: ["Add some URLs to get topic suggestions."] }) };
  }
  const currentAi = getAiInstance();
  const urlList = urls.join('\n');
  
  // Prompt updated to request JSON output of short questions
  const promptText = `Based on the content of the following documentation URLs, provide 3-4 concise and actionable questions a developer might ask to explore these documents. These questions should be suitable as quick-start prompts. Return ONLY a JSON object with a key "suggestions" containing an array of these question strings. For example: {"suggestions": ["What are the rate limits?", "How do I get an API key?", "Explain model X."]}

Relevant URLs:
${urlList}`;

  const contents: Content[] = [{ role: "user", parts: [{ text: promptText }] }];

  try {
    const response: GenerateContentResponse = await currentAi.models.generateContent({
      model: MODEL_NAME,
      contents: contents,
      config: {
        safetySettings: safetySettings,
        responseMimeType: "application/json", // Request JSON output
      },
    });

    const text = response.text; // This should be the JSON string
    // urlContextMetadata is not expected here because tools cannot be used with responseMimeType: "application/json"
    // const urlContextMetadata = response.candidates?.[0]?.urlContextMetadata?.urlMetadata as UrlContextMetadataItem[] | undefined;
    
    return { text /*, urlContextMetadata: undefined */ }; // Explicitly undefined or not included

  } catch (error) {
    console.error("Error calling Gemini API for initial suggestions:", error);
     if (error instanceof Error) {
      const googleError = error as any; 
      if (googleError.message && googleError.message.includes("API key not valid")) {
         throw new Error("Invalid API Key for suggestions. Please check your GEMINI_API_KEY environment variable.");
      }
      // Check for the specific error message and re-throw a more informative one if needed
      if (googleError.message && googleError.message.includes("Tool use with a response mime type: 'application/json' is unsupported")) {
        throw new Error("Configuration error: Cannot use tools with JSON response type for suggestions. This should be fixed in the code.");
      }
      throw new Error(`Failed to get initial suggestions from AI: ${error.message}`);
    }
    throw new Error("Failed to get initial suggestions from AI due to an unknown error.");
  }
};
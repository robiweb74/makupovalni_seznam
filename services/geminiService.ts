
import { GoogleGenAI, Type } from "@google/genai";

export const getSmartSuggestions = async (listName: string, existingItems: string[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Na podlagi imena seznama "${listName}" in obstoječih artiklov (${existingItems.join(', ')}), predlagaj 5 dodatnih artiklov, ki bi jih uporabnik morda potreboval. Odgovori v slovenščini v JSON formatu.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    const data = JSON.parse(response.text);
    return data.suggestions as string[];
  } catch (error) {
    console.error("Gemini suggestion error:", error);
    return [];
  }
};

export const autoCategorize = async (item: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Kam v trgovini spada artikel "${item}"? Odgovori z eno samo besedo (npr. Sadje, Zelenjava, Mlečni izdelki, Meso, Čistila, Pijača).`,
    });
    return response.text.trim();
  } catch {
    return "Ostalo";
  }
};

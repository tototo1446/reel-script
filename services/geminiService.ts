
import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisData, GeneratedScript } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const analyzeCompetitorReel = async (input: string): Promise<Partial<AnalysisData>> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `以下は競合のリール動画の文字起こし、または内容のメモです。
    これを「フック(Hook)」「問題提起(Problem)」「解決策(Solution)」「CTA」の4つの構成に分解し、
    さらに「カメラ距離」「人物配置」「テロップ」などの演出意図を推測してJSON形式で出力してください。

    Input: ${input}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          structure: {
            type: Type.OBJECT,
            properties: {
              hook: { type: Type.STRING },
              problem: { type: Type.STRING },
              solution: { type: Type.STRING },
              cta: { type: Type.STRING }
            },
            required: ['hook', 'problem', 'solution', 'cta']
          },
          direction: {
            type: Type.OBJECT,
            properties: {
              camera: { type: Type.STRING },
              person: { type: Type.STRING },
              caption: { type: Type.STRING }
            },
            required: ['camera', 'person', 'caption']
          },
          transcription: { type: Type.STRING }
        },
        required: ['title', 'structure', 'direction', 'transcription']
      }
    }
  });

  return JSON.parse(response.text);
};

export const generateSmartScript = async (
  theme: string,
  tone: string,
  patterns: AnalysisData[]
): Promise<GeneratedScript> => {
  const patternContext = patterns.map(p => `[Pattern: ${p.title}] Hook Strategy: ${p.structure.hook}, Style: ${p.direction.camera}`).join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `あなたはSNS動画マーケティングのプロです。
    以下の「勝ちパターン」を参考に、新しいテーマ「${theme}」で、トーン「${tone}」のリール台本を生成してください。
    
    【参考にすべき勝ちパターン】
    ${patternContext}

    【出力ルール】
    - 構成・流れ・テンポは参考パターンを維持する
    - 秒数付きのシーンに分ける
    - 各シーンには「セリフ」「テロップ」「具体的演出（例：0-3秒: 120%ズーム）」を含める`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          theme: { type: Type.STRING },
          tone: { type: Type.STRING },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                time: { type: Type.STRING },
                dialogue: { type: Type.STRING },
                caption: { type: Type.STRING },
                direction: { type: Type.STRING }
              },
              required: ['time', 'dialogue', 'caption', 'direction']
            }
          }
        },
        required: ['theme', 'tone', 'scenes']
      }
    }
  });

  const result = JSON.parse(response.text);
  return {
    ...result,
    id: Math.random().toString(36).substr(2, 9),
    patternId: patterns[0]?.id || 'custom'
  };
};

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as SecureStore from 'expo-secure-store';

const API_KEY_STORAGE = 'gemini_api_key';

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private apiKey: string | null = null;

  async setApiKey(key: string): Promise<void> {
    await SecureStore.setItemAsync(API_KEY_STORAGE, key);
    this.apiKey = key;
    this.genAI = new GoogleGenerativeAI(key);
  }

  async getApiKey(): Promise<string | null> {
    if (this.apiKey) return this.apiKey;
    this.apiKey = await SecureStore.getItemAsync(API_KEY_STORAGE);
    if (this.apiKey) this.genAI = new GoogleGenerativeAI(this.apiKey);
    return this.apiKey;
  }

  async clearApiKey(): Promise<void> {
    await SecureStore.deleteItemAsync(API_KEY_STORAGE);
    this.apiKey = null;
    this.genAI = null;
  }

  get isConfigured(): boolean {
    return this.apiKey != null && this.apiKey.length > 0;
  }

  async ensureInitialized(): Promise<boolean> {
    if (!this.apiKey) await this.getApiKey();
    return this.isConfigured;
  }

  async validateApiKey(): Promise<boolean> {
    try {
      const key = this.apiKey ?? await this.getApiKey();
      if (!key) return false;
      const ai = new GoogleGenerativeAI(key);
      const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent('回覆 OK');
      return result.response.text().length > 0;
    } catch {
      return false;
    }
  }

  async analyzeFood(imageBase64: string): Promise<Record<string, any>> {
    return this._sendWithImage(PROMPTS.foodRecognition, imageBase64);
  }

  async analyzeTraining(data: Record<string, any>): Promise<Record<string, any>> {
    return this._send(PROMPTS.trainingAnalysis(data));
  }

  async analyzeBodyComposition(data: Record<string, any>): Promise<Record<string, any>> {
    return this._send(PROMPTS.bodyCompositionAnalysis(data));
  }

  async generateWeeklyReport(data: Record<string, any>): Promise<Record<string, any>> {
    return this._send(PROMPTS.weeklyReport(data));
  }

  async askCoach(question: string, context: Record<string, any>): Promise<Record<string, any>> {
    return this._send(PROMPTS.coachQA(question, context));
  }

  private async _send(prompt: string): Promise<Record<string, any>> {
    try {
      if (!this.genAI) throw new Error('未設定 API Key');
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      return parseResponse(result.response.text());
    } catch (e: any) {
      return { error: `AI 請求失敗：${e.message}` };
    }
  }

  private async _sendWithImage(prompt: string, imageBase64: string): Promise<Record<string, any>> {
    try {
      if (!this.genAI) throw new Error('未設定 API Key');
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent([
        prompt,
        { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
      ]);
      return parseResponse(result.response.text());
    } catch (e: any) {
      return { error: `AI 請求失敗：${e.message}` };
    }
  }
}

function parseResponse(raw: string): Record<string, any> {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { error: '無法解析 AI 回應', rawResponse: raw };
  }
}

const SYSTEM = `你是一位專業的健身教練和營養師，專精於台灣客戶的健康管理。
你必須只用繁體中文回覆。你必須只回傳有效的 JSON 格式，不要加任何 markdown 標記。`;

const PROMPTS = {
  foodRecognition: `${SYSTEM}
請分析這張食物照片，辨識所有可見的食物項目。
特別注意台灣常見食物（便當、小吃、手搖飲、夜市食物等）。
回傳 JSON：
{"foods":[{"name":"食物名","portion":"份量","calories":數字,"protein":數字,"carbs":數字,"fat":數字,"confidence":0到1}],"totalCalories":數字,"notes":"建議"}`,

  trainingAnalysis: (data: any) => `${SYSTEM}
使用者過去 7 天訓練記錄：${JSON.stringify(data, null, 2)}
分析並回傳 JSON：
{"summary":"總結","volumeAssessment":"訓練量評估","suggestions":["建議1","建議2"],"riskLevel":"low/medium/high"}`,

  bodyCompositionAnalysis: (data: any) => `${SYSTEM}
使用者身體組成歷史：${JSON.stringify(data, null, 2)}
分析並回傳 JSON：
{"summary":"總結","trend":"趨勢","isHealthyProgress":true或false,"suggestions":["建議1"],"score":0到100}`,

  weeklyReport: (data: any) => `${SYSTEM}
使用者本週數據：${JSON.stringify(data, null, 2)}
產生週報 JSON：
{"summary":"總結","dietScore":0到100,"trainingScore":0到100,"overallScore":0到100,"highlights":["亮點"],"nextWeekGoals":["目標"],"motivationalMessage":"鼓勵"}`,

  coachQA: (question: string, context: any) => `${SYSTEM}
使用者資料：${JSON.stringify(context, null, 2)}
問題：${question}
回傳 JSON：
{"answer":"回答","relatedTips":["提示"],"actionItems":["行動"]}`,
};

export const geminiService = new GeminiService();

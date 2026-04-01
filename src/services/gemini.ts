import { getAccessToken } from './auth';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MODEL = 'gemini-2.0-flash';

class GeminiService {
  private accessToken: string | null = null;

  async ensureInitialized(): Promise<boolean> {
    if (!this.accessToken) {
      this.accessToken = await getAccessToken();
    }
    return this.accessToken != null;
  }

  get isConfigured(): boolean {
    return this.accessToken != null;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
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
      await this.ensureInitialized();
      console.log('[Gemini] token:', this.accessToken ? 'YES (' + this.accessToken.substring(0, 15) + '...)' : 'NO');
      if (!this.accessToken) throw new Error('請先登入 Google 帳號');

      const res = await fetch(`${GEMINI_API_BASE}/${MODEL}:generateContent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      console.log('[Gemini] response status:', res.status);
      const rawBody = await res.text();
      console.log('[Gemini] response body:', rawBody.substring(0, 300));

      if (!res.ok) {
        throw new Error(`API 錯誤 ${res.status}: ${rawBody}`);
      }

      const data = JSON.parse(rawBody);
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { error: 'AI 沒有回傳任何內容' };
      return parseResponse(text);
    } catch (e: any) {
      console.error('[Gemini] error:', e);
      return { error: `AI 請求失敗：${e.message}` };
    }
  }

  private async _sendWithImage(prompt: string, imageBase64: string): Promise<Record<string, any>> {
    try {
      await this.ensureInitialized();
      if (!this.accessToken) throw new Error('請先登入 Google 帳號');

      const res = await fetch(`${GEMINI_API_BASE}/${MODEL}:generateContent`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
            ],
          }],
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API 錯誤 ${res.status}: ${err}`);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) return { error: 'AI 沒有回傳任何內容' };
      return parseResponse(text);
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

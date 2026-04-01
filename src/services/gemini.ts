import { Platform } from 'react-native';

// ============================================================
// Multi-provider AI Service: Gemini / OpenAI GPT
// 用戶可在設定頁選擇要用哪個 AI 供應商
// ============================================================

type AIProvider = 'gemini' | 'openai';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const OPENAI_BASE = 'https://api.openai.com/v1/chat/completions';

function getStored(key: string): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.localStorage.getItem(key);
  }
  return null;
}
function setStored(key: string, value: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.localStorage.setItem(key, value);
  }
}

class GeminiService {
  private provider: AIProvider = 'gemini';
  private geminiKey: string | null = null;
  private openaiKey: string | null = null;

  constructor() {
    this.provider = (getStored('ai_provider') as AIProvider) ?? 'gemini';
    this.geminiKey = getStored('gemini_api_key');
    this.openaiKey = getStored('openai_api_key');
  }

  // -- Config --
  get currentProvider(): AIProvider { return this.provider; }

  setProvider(p: AIProvider) {
    this.provider = p;
    setStored('ai_provider', p);
  }

  get isConfigured(): boolean {
    if (this.provider === 'gemini') return (this.geminiKey ?? getStored('gemini_api_key')) != null;
    return (this.openaiKey ?? getStored('openai_api_key')) != null;
  }

  async ensureInitialized(): Promise<boolean> {
    this.geminiKey = getStored('gemini_api_key');
    this.openaiKey = getStored('openai_api_key');
    return this.isConfigured;
  }

  setApiKey(key: string) {
    if (this.provider === 'gemini') {
      this.geminiKey = key;
      setStored('gemini_api_key', key);
    } else {
      this.openaiKey = key;
      setStored('openai_api_key', key);
    }
  }

  setGeminiKey(key: string) { this.geminiKey = key; setStored('gemini_api_key', key); }
  setOpenAIKey(key: string) { this.openaiKey = key; setStored('openai_api_key', key); }

  getApiKey(): string | null {
    return this.provider === 'gemini' ? (this.geminiKey ?? getStored('gemini_api_key')) : (this.openaiKey ?? getStored('openai_api_key'));
  }

  getGeminiKey(): string | null { return this.geminiKey ?? getStored('gemini_api_key'); }
  getOpenAIKey(): string | null { return this.openaiKey ?? getStored('openai_api_key'); }

  setAccessToken(_t: string) {} // backward compat

  async validateApiKey(key?: string): Promise<boolean> {
    const k = key ?? this.getApiKey();
    if (!k) return false;
    try {
      if (this.provider === 'gemini') {
        const res = await fetch(`${GEMINI_BASE}/gemini-2.0-flash:generateContent?key=${k}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'OK' }] }] }),
        });
        return res.ok;
      } else {
        const res = await fetch(OPENAI_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${k}` },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'OK' }], max_tokens: 5 }),
        });
        return res.ok;
      }
    } catch { return false; }
  }

  // -- AI Methods --
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

  // -- Internal --
  private async _send(prompt: string): Promise<Record<string, any>> {
    await this.ensureInitialized();
    const key = this.getApiKey();
    if (!key) return { error: `請先到設定頁設定 ${this.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API Key` };
    try {
      if (this.provider === 'gemini') return this._sendGemini(prompt, key);
      return this._sendOpenAI(prompt, key);
    } catch (e: any) {
      return { error: `AI 請求失敗：${e.message}` };
    }
  }

  private async _sendWithImage(prompt: string, imageBase64: string): Promise<Record<string, any>> {
    await this.ensureInitialized();
    const key = this.getApiKey();
    if (!key) return { error: `請先到設定頁設定 ${this.provider === 'gemini' ? 'Gemini' : 'OpenAI'} API Key` };
    try {
      if (this.provider === 'gemini') return this._sendGeminiImage(prompt, imageBase64, key);
      return this._sendOpenAIImage(prompt, imageBase64, key);
    } catch (e: any) {
      return { error: `AI 請求失敗：${e.message}` };
    }
  }

  private async _sendGemini(prompt: string, key: string): Promise<Record<string, any>> {
    const res = await fetch(`${GEMINI_BASE}/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`${res.status}: ${raw.substring(0, 200)}`);
    const data = JSON.parse(raw);
    return parseResponse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
  }

  private async _sendGeminiImage(prompt: string, img: string, key: string): Promise<Record<string, any>> {
    const res = await fetch(`${GEMINI_BASE}/gemini-2.0-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: img } }] }],
      }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`${res.status}: ${raw.substring(0, 200)}`);
    const data = JSON.parse(raw);
    return parseResponse(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
  }

  private async _sendOpenAI(prompt: string, key: string): Promise<Record<string, any>> {
    const res = await fetch(OPENAI_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`${res.status}: ${raw.substring(0, 200)}`);
    const data = JSON.parse(raw);
    return parseResponse(data.choices?.[0]?.message?.content ?? '');
  }

  private async _sendOpenAIImage(prompt: string, img: string, key: string): Promise<Record<string, any>> {
    const res = await fetch(OPENAI_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `${SYSTEM}\n${prompt}` },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } },
          ],
        }],
        response_format: { type: 'json_object' },
      }),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`${res.status}: ${raw.substring(0, 200)}`);
    const data = JSON.parse(raw);
    return parseResponse(data.choices?.[0]?.message?.content ?? '');
  }
}

function parseResponse(raw: string): Record<string, any> {
  if (!raw) return { error: 'AI 沒有回傳任何內容' };
  let cleaned = raw.trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.slice(7);
  else if (cleaned.startsWith('```')) cleaned = cleaned.slice(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  try { return JSON.parse(cleaned); }
  catch { return { error: '無法解析 AI 回應', rawResponse: raw }; }
}

const SYSTEM = `你是一位專業的健身教練和營養師，專精於台灣客戶的健康管理。你必須只用繁體中文回覆。你必須只回傳有效的 JSON 格式，不要加任何 markdown 標記。`;

const PROMPTS = {
  foodRecognition: `請分析這張食物照片，辨識所有可見的食物項目。特別注意台灣常見食物。\n回傳 JSON：{"foods":[{"name":"食物名","portion":"份量","calories":數字,"protein":數字,"carbs":數字,"fat":數字,"confidence":0到1}],"totalCalories":數字,"notes":"建議"}`,
  trainingAnalysis: (d: any) => `訓練記錄：${JSON.stringify(d)}\n回傳 JSON：{"summary":"總結","volumeAssessment":"訓練量評估","suggestions":["建議1","建議2"],"riskLevel":"low/medium/high"}`,
  bodyCompositionAnalysis: (d: any) => `身體組成歷史：${JSON.stringify(d)}\n回傳 JSON：{"summary":"總結","trend":"趨勢","isHealthyProgress":true或false,"suggestions":["建議1"],"score":0到100}`,
  weeklyReport: (d: any) => `本週數據：${JSON.stringify(d)}\n回傳 JSON：{"summary":"總結","dietScore":0到100,"trainingScore":0到100,"overallScore":0到100,"highlights":["亮點"],"nextWeekGoals":["目標"],"motivationalMessage":"鼓勵"}`,
  coachQA: (q: string, c: any) => `使用者資料：${JSON.stringify(c)}\n問題：${q}\n回傳 JSON：{"answer":"回答","relatedTips":["提示"],"actionItems":["行動"]}`,
};

export const geminiService = new GeminiService();

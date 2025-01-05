import { requestUrl } from 'obsidian';
import systemPrompt from '../prompts/system';
import summaryPrompt from '../prompts/summary';
import { OLLAMA_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL } from '../constants';

export interface Message {
  role: string;
  content: string;
}

export type Mode = 'openai' | 'ollama';
export interface ChatInput {
  apiKey: string | undefined;
  messages: Message[];
  isSummary: boolean | undefined;
  mode: Mode;
  ollamaUrl: string | undefined;
  model: string | undefined;
  language: string;
}

export class ChatCbt {
  constructor() {}

  async chat({
    apiKey,
    messages,
    isSummary = false,
    mode = 'openai',
    ollamaUrl,
    model,
    language,
  }: ChatInput): Promise<string> {
    const SYSTEM_MSG = { role: 'system', content: systemPrompt(language) };
    const SUMMARY_MSG = { role: 'user', content: summaryPrompt(language) };

    const resolvedMsgs = [...messages];

    if (isSummary) {
      resolvedMsgs.push(SUMMARY_MSG);
    }

    let response = '';

    const msgs = [SYSTEM_MSG, ...resolvedMsgs];

    /** validations should be guaranteed from parent layer, based on mode. Re-validating here to appease typescript gods */
    if (mode === 'openai' && !!apiKey) {
      const url = 'https://api.openai.com/v1/chat/completions';
      response = await this._chat(
        url,
        msgs,
        apiKey,
        model || OPENAI_DEFAULT_MODEL,
      );
    } else if (mode === 'ollama' && !!ollamaUrl) {
      const url = ollamaUrl.replace(/\/$/, '') + '/v1/chat/completions';
      response = await this._chat(
        url,
        msgs,
        'ollama', // default API Key used by Ollama's OpenAI style chat endpoint (v0.1.24^)
        model || OLLAMA_DEFAULT_MODEL,
      );
    }

    return response;
  }

  async _chat(
    url: string,
    messages: Message[],
    apiKey: string,
    model: string | undefined,
  ): Promise<string> {
    const data = {
      model,
      messages,
      temperature: 0.7,
    };

    const headers = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    };

    const options = {
      url,
      method: 'POST',
      body: JSON.stringify(data),
      headers: headers as unknown as Record<string, string>,
    };

    const response: {
      json: { choices: { message: { content: string } }[] };
    } = await requestUrl(options);

    return response.json.choices[0].message.content;
  }
}

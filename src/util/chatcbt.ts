import summaryPrompt from '../prompts/summary';
import { OLLAMA_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL } from '../constants';

const defaultPromptPrefix = (lang: string) =>
	`Respond to the user in ${lang}.\n`;

export interface Message {
	role: string;
	content: string;
}

// Include "openrouter" in the Mode type.
export type Mode = 'openai' | 'ollama' | 'openrouter';

export interface ChatInput {
	apiKey: string | undefined;
	messages: Message[];
	isSummary: boolean | undefined;
	mode: Mode;
	ollamaUrl: string | undefined;
	openRouterUrl?: string; // Added openRouterUrl to the interface.
	model: string | undefined;
	language: string;
	prompt: string;
}

export class ChatCbt {
	constructor() {}

	async chat({
		apiKey,
		messages,
		isSummary = false,
		mode = 'openai',
		ollamaUrl,
		openRouterUrl,
		model,
		language,
		prompt,
	}: ChatInput): Promise<string> {
		const SYSTEM_MSG = {
			role: 'system',
			content: defaultPromptPrefix(language) + prompt,
		};
		const SUMMARY_MSG = { role: 'user', content: summaryPrompt(language) };

		const resolvedMsgs = [...messages];

		if (isSummary) {
			resolvedMsgs.push(SUMMARY_MSG);
		}

		let response = '';

		const msgs = [SYSTEM_MSG, ...resolvedMsgs];

		/** validations should be guaranteed from parent layer */
		if (mode === 'openai' && !!apiKey) {
			const url = 'https://api.openai.com/v1/chat/completions';
			response = await this._chat(
				url,
				msgs,
				apiKey || '',
				model || OPENAI_DEFAULT_MODEL,
			);
		} else if (mode === 'ollama' && !!ollamaUrl) {
			const url = ollamaUrl.replace(/\/$/, '') + '/v1/chat/completions';
			response = await this._chat(
				url,
				msgs,
				'ollama', // default API Key used by Ollama's endpoint
				model || OLLAMA_DEFAULT_MODEL,
			);
		} else if (mode === 'openrouter' && !!openRouterUrl) {
			const url = openRouterUrl.replace(/\/$/, '') + '/v1/chat/completions';
			response = await this._chat(
				url,
				msgs,
				apiKey || '',
				model || OPENAI_DEFAULT_MODEL,
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
			headers: headers,
		};

		// Use fetch as a replacement for requestUrl.
		const res = await fetch(options.url, {
			method: options.method,
			headers: options.headers,
			body: options.body,
		});
		const json = await res.json();
		return json.choices[0].message.content;
	}
}
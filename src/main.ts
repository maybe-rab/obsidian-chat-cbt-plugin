import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	Menu,
	MarkdownRenderer,
	Component,
} from 'obsidian';
import { ChatCbt, Mode } from './util/chatcbt';
import { buildAssistantMsg, convertTextToMsg } from './util/messages';
import { platformBasedSecrets } from './util/platformBasedSecrets';
import { OLLAMA_DEFAULT_MODEL, OPENAI_DEFAULT_MODEL } from './constants';
import { languages } from './util/languages';
import defaultSystemPrompt from './prompts/system';

/** Interfaces */
interface ChatCbtPluginSettings {
	openAiApiKey: string;
	mode: string;
	model: string;
	ollamaUrl: string;
	openRouterUrl: string;
	language: string;
	prompt: string;
}

interface ChatCbtResponseInput {
	isSummary: boolean;
	mode: Mode;
}

/** Constants */
const VALID_MODES = ['openai', 'ollama', 'openrouter'];
const DEFAULT_LANG = 'English';

const DEFAULT_SETTINGS: ChatCbtPluginSettings = {
	openAiApiKey: '',
	mode: 'openai',
	model: '',
	ollamaUrl: 'http://0.0.0.0:11434',
	openRouterUrl: '',
	language: DEFAULT_LANG,
	prompt: defaultSystemPrompt,
};

/** Initialize chat client */
const chatCbt = new ChatCbt();

export default class ChatCbtPlugin extends Plugin {
	settings: ChatCbtPluginSettings;

	async onload() {
		console.log('loading plugin');

		await this.loadSettings();

		// Create an icon in the left ribbon.
		this.addRibbonIcon('heart-handshake', 'ChatCBT', (evt: MouseEvent): void => {
			const menu = new Menu();
			menu.addItem((item: any): void => {
				item.setTitle('Chat')
					.setIcon('message-circle')
					.onClick((): void => {
						this.getChatCbtRepsonse({
							isSummary: false,
							mode: 'openai',
						});
					});
			});
			menu.addItem((item: any): void => {
				item.setTitle('Summarise')
					.setIcon('table')
					.onClick((): void => {
						this.getChatCbtSummary();
					});
			});
			menu.showAtMouseEvent(evt);
		});

		// Add editor commands.
		this.addCommand({
			id: 'chat',
			name: 'Chat',
			editorCallback: (_editor: Editor, _view: MarkdownView): void => {
				this.getChatCbtRepsonse({
					isSummary: false,
					mode: this.settings.mode as Mode,
				});
			},
		});
		this.addCommand({
			id: 'summarise',
			name: 'Summarise',
			editorCallback: (_editor: Editor, _view: MarkdownView): void => {
				this.getChatCbtSummary();
			},
		});

		// Add a settings tab.
		this.addSettingTab(new MySettingTab(this.app, this));
	}

	onunload() {
		console.log('unloading plugin');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async getChatCbtRepsonse({ isSummary = false, mode = 'openai' }: ChatCbtResponseInput): Promise<void> {
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) {
			return;
		}

		if (!VALID_MODES.includes(this.settings.mode)) {
			new Notice(`Invalid mode '${this.settings.mode}' detected. Update in ChatCBT plugin settings and select a valid mode`);
			return;
		}

		if (this.settings.mode === 'openai' && !this.settings.openAiApiKey) {
			new Notice('Missing OpenAI API Key - update in ChatCBT plugin settings');
			return;
		}

		if (this.settings.mode === 'ollama' && !this.settings.ollamaUrl) {
			new Notice('Missing Ollama URL - update in ChatCBT plugin settings');
			return;
		}

		if (this.settings.mode === 'openrouter' && !this.settings.openRouterUrl) {
			new Notice('Missing OpenRouter URL - update in ChatCBT plugin settings');
			return;
		}

		const existingText = await this.app.vault.read(activeFile);
		if (!existingText.trim()) {
			new Notice('First, share how you are feeling in a note');
			return;
		}

		const messages = existingText
			.split(/---+/)
			.map((i: string): string => i.trim())
			.map((i: string): any => convertTextToMsg(i));

		// Determine selected model.
		const selectedModel = this.settings.model
			? this.settings.model
			: this.settings.mode === 'openai'
			? OPENAI_DEFAULT_MODEL
			: OLLAMA_DEFAULT_MODEL;

		const loadingModal = new MarkdownTextModel(
			this.app,
			`Asking ChatCBT...\n\n_mode: ${this.settings.mode}_\n\n_model: ${selectedModel}_`
		);
		loadingModal.open(); // Uses our added open() method below

		let response = '';

		try {
			const apiKey = this.settings.openAiApiKey ? platformBasedSecrets.decrypt(this.settings.openAiApiKey) : '';
			const res = await chatCbt.chat({
				apiKey,
				messages,
				isSummary,
				mode: this.settings.mode as Mode,
				ollamaUrl: this.settings.ollamaUrl,
				openRouterUrl: this.settings.openRouterUrl, // Now accepted by ChatInput
				model: this.settings.model,
				language: this.settings.language,
				prompt: this.settings.prompt,
			});
			response = res;
		} catch (e: any) {
			let msg = e.msg;
			if (e.status === 404) {
				msg = `Model named '${this.settings.model}' not found for ${this.settings.mode}. Update mode or model name in settings.`;
			}
			new Notice(`ChatCBT failed :(: ${msg}`);
			console.error(e);
		} finally {
			loadingModal.close(); // Uses our added close() method below
		}

		if (response) {
			const MSG_PADDING = '\n\n';
			const appendMsg = isSummary ? MSG_PADDING + response : buildAssistantMsg(response);
			await this.app.vault.append(activeFile, appendMsg);
		}
	}

	async getChatCbtSummary(): Promise<void> {
		await this.getChatCbtRepsonse({ isSummary: true, mode: 'openai' });
	}
}

class MySettingTab extends PluginSettingTab {
	plugin: ChatCbtPlugin;

	constructor(app: App, plugin: ChatCbtPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('a', {
			href: 'https://github.com/clairefro/obsidian-chat-cbt-plugin/blob/main/README.md',
			text: 'Read the setup guide ↗️ ',
		});
		containerEl.createEl('br');
		containerEl.createEl('br');

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('Create an OpenAI API Key from their website and paste here (Make sure you have added credits to your account!)')
			.addText((text: any): any =>
				text.setPlaceholder('Enter your API Key')
					.setValue(
						this.plugin.settings.openAiApiKey
							? platformBasedSecrets.decrypt(this.plugin.settings.openAiApiKey)
							: ''
					)
					.onChange(async (value: string): Promise<void> => {
						if (!value.trim()) {
							this.plugin.settings.openAiApiKey = '';
						} else {
							this.plugin.settings.openAiApiKey = platformBasedSecrets.encrypt(value.trim());
						}
						await this.plugin.saveSettings();
					})
			);

		const link = document.createElement('a');
		link.textContent = 'Get OpenAI API Key';
		link.href = 'https://platform.openai.com/api-keys';
		link.target = '_blank';
		link.style.textDecoration = 'underline';
		containerEl.appendChild(link);

		containerEl.createEl('br');
		containerEl.createEl('br');

		new Setting(containerEl)
			.setName('Ollama mode (local)')
			.setDesc('Toggle on for a local experience if you are running Ollama')
			.addToggle((toggle: any): any =>
				toggle.setValue(this.plugin.settings.mode === 'openai' ? false : true)
					.onChange(async (value: boolean): Promise<void> => {
						this.plugin.settings.mode = value ? 'ollama' : 'openai';
						this.updateModelPlaceholder(containerEl);
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName('Ollama server URL')
			.setDesc('Edit this if you changed the default port for using Ollama. Requires Ollama v0.1.24 or higher.')
			.addText((text: any): any =>
				text.setPlaceholder('ex: http://0.0.0.0:11434')
					.setValue(this.plugin.settings.ollamaUrl)
					.onChange(async (value: string): Promise<void> => {
						this.plugin.settings.ollamaUrl = value.trim();
						await this.plugin.saveSettings();
					})
			);

		if (this.plugin.settings.mode === 'openrouter') {
			new Setting(containerEl)
				.setName('OpenRouter Server URL')
				.setDesc('Specify the URL for the OpenRouter endpoint.')
				.addText((text: any): any =>
					text.setPlaceholder('ex: https://api.openrouter.com/v1')
						.setValue(this.plugin.settings.openRouterUrl)
						.onChange(async (value: string): Promise<void> => {
							this.plugin.settings.openRouterUrl = value.trim();
							await this.plugin.saveSettings();
						})
				);
		}

		containerEl.createEl('br');
		containerEl.createEl('br');

		// Replace setClass with addClass (if available) or remove it.
		new Setting(containerEl)
			.setName('Model')
			// .setClass('chat-cbt-model-setting') <-- removed since setClass is not defined
			.setDesc('If you prefer a different model to the default at the right. Delete text to restore defaults')
			.addText((text: any): any =>
				text.setPlaceholder(
					this.plugin.settings.mode === 'openai'
						? OPENAI_DEFAULT_MODEL
						: OLLAMA_DEFAULT_MODEL
				)
					.setValue(this.plugin.settings.model)
					.onChange(async (value: string): Promise<void> => {
						this.plugin.settings.model = value.trim();
						await this.plugin.saveSettings();
					})
			);

		containerEl.createEl('br');
		containerEl.createEl('br');

		new Setting(containerEl)
			.setName('Preferred Language (Beta)')
			.setDesc('For responses from ChatCBT')
			.addDropdown((dropdown: any): any => {
				languages.forEach((lang: { value: string; label: string }): void => {
					dropdown.addOption(lang.value, lang.label);
				});
				dropdown.setValue(this.plugin.settings.language || 'English')
					.onChange(async (value: string): Promise<void> => {
						this.plugin.settings.language = value;
						await this.plugin.saveSettings();
					});
			});

		const promptSetting = new Setting(containerEl)
			.setName('Edit System Prompt')
			.setDesc('Customise the prompt that controls how ChatCBT responds to you');
			// .setClass('chat-cbt-prompt-setting'); <-- removed

		promptSetting.addTextArea((text: any): any => {
			text.setValue(this.plugin.settings.prompt)
				.onChange(async (value: string): Promise<void> => {
					this.plugin.settings.prompt = value;
					updateResetButtonVisibility(value);
					await this.plugin.saveSettings();
				});
			text.inputEl.addClass('chat-cbt-prompt-textarea');
			return text;
		});

		const buttonContainer = containerEl.createDiv('chat-cbt-button-container');
		const resetButton = new Setting(buttonContainer).addButton((button: any): any =>
			button.setButtonText('Reset to Default')
				.onClick(async (): Promise<void> => {
					const confirmReset = confirm("Are you sure you want to reset the prompt to default? You'll lose your custom prompt.");
					if (confirmReset) {
						this.plugin.settings.prompt = defaultSystemPrompt;
						const textareaElement = containerEl.querySelector('.chat-cbt-prompt-textarea') as HTMLTextAreaElement;
						if (textareaElement) {
							textareaElement.value = defaultSystemPrompt;
						}
						await this.plugin.saveSettings();
						new Notice('ChatCBT prompt reset to default');
						updateResetButtonVisibility(defaultSystemPrompt);
					}
				})
		);

		// Remove resetButton.nameEl and resetButton.controlEl lines since those properties are undefined.
		const updateResetButtonVisibility = (value: string): void => {
			const shouldShow = value !== defaultSystemPrompt;
			buttonContainer.style.display = shouldShow ? 'flex' : 'none';
		};
		updateResetButtonVisibility(this.plugin.settings.prompt);
	}

	private updateModelPlaceholder(containerEl: HTMLElement): void {
		const isOpenAiMode = this.plugin.settings.mode === 'openai';
		const placeholderText = isOpenAiMode ? OPENAI_DEFAULT_MODEL : OLLAMA_DEFAULT_MODEL;
		setTimeout((): void => {
			const modelSettingInput = containerEl.querySelector('.chat-cbt-model-setting input') as HTMLInputElement | null;
			if (modelSettingInput) {
				modelSettingInput.placeholder = placeholderText;
			} else {
				console.warn('Model setting input element not found');
			}
		}, 0);
	}
}

// Extend MarkdownTextModel with open() and close() methods.
class MarkdownTextModel extends Modal {
	text: string;
	component: Component;
	constructor(app: App, _text: string) {
		super(app);
		this.text = _text;
		this.component = new Component();
	}

	// Add an open method that calls the base modal's onOpen and then displays the modal.
	open(): void {
		this.onOpen();
		// In a real plugin, the modal would be added to the DOM.
	}

	// Add a close method that calls onClose.
	close(): void {
		this.onClose();
	}

	onOpen(): void {
		const markdownContainer = this.contentEl.createDiv('markdown-container');
		MarkdownRenderer.render(this.app, this.text, markdownContainer, '', this.component);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
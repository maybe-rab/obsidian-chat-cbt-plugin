declare module "obsidian" {
	// Minimal type declarations for the Obsidian API. Replace or expand as needed.
	
	export class Plugin {
		app: App;
		onload(): void;
		onunload(): void;
		loadData(): Promise<any>;
		saveData(data: any): Promise<void>;
		addRibbonIcon(icon: string, title: string, callback: (evt: MouseEvent) => void): HTMLElement;
		addCommand(command: { id: string; name: string; editorCallback?: (editor: Editor, view: MarkdownView) => void; }): void;
		addSettingTab(tab: PluginSettingTab): void;
	}
	
	export class Modal {
		app: App;
		contentEl: HTMLElement;
		constructor(app: App);
		onOpen(): void;
		onClose(): void;
	}
	
	export class App {
		workspace: { getActiveFile(): any };
		vault: { read(file: any): Promise<string>; append(file: any, data: string): Promise<void> };
	}
	
	export class Menu {
		addItem(callback: (item: any) => void): Menu;
		showAtMouseEvent(evt: MouseEvent): void;
	}
	
	export class Notice {
		constructor(message: string);
	}
	
	export class PluginSettingTab {
		containerEl: HTMLElement;
		constructor(app: App, plugin: Plugin);
		display(): void;
	}
	
	export class Setting {
		constructor(containerEl: HTMLElement);
		setName(name: string): this;
		setDesc(desc: string): this;
		addText(callback: (text: any) => any): this;
		addTextArea(callback: (text: any) => any): this;
		addToggle(callback: (toggle: any) => any): this;
		addDropdown(callback: (dropdown: any) => any): this;
		addButton(callback: (button: any) => any): this;
	}
	
	export class MarkdownView {}
	export class Editor {}
	export class MarkdownRenderer {
		static render(app: App, markdown: string, el: HTMLElement, sourcePath: string, component: any): void;
	}
	export class Component {}
}
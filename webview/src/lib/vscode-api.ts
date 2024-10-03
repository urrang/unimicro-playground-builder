import type { WebviewApi } from 'vscode-webview';
import type { ExtensionState } from './state';

class VSCodeAPIWrapper {
	private readonly vsCodeApi: WebviewApi<ExtensionState> | undefined;

	constructor() {
		if (typeof acquireVsCodeApi === 'function') {
			this.vsCodeApi = acquireVsCodeApi();
		}
	}

	public postMessage(command: string, data?: any) {
		this.vsCodeApi!.postMessage({ command, data });
	}

	public saveState<T extends ExtensionState>(newState: T) {
		this.postMessage('save_state', newState);
	}
}

export const vscode = new VSCodeAPIWrapper();

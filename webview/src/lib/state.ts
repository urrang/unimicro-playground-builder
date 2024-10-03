import { get, writable } from 'svelte/store';
import { vscode } from './vscode-api';

export interface ExtensionState {
	auth?: {
		username: string;
		token: string;
	};
	properties: {
		API_BRANCH_NAME: string;
		UX_BRANCH_NAME: string;
		THEME: string;
		LICENSING_API_BRANCH_NAME: string;
		LICENSING_FRONTEND_BRANCH_NAME: string;
		INTEGRATION_BRANCH_NAME: string;
		SIGNAL_BRANCH_NAME: string;
		JOBSERVER_BRANCH_NAME: string;
		UNIFILES_BRANCH_NAME: string;
		DATABASE_PREFIX: string;
		IIS_WEBSITE_NAME: string;
		IDENTITY: string;
		INITIAL_MIGRATION: string;
	};
}

export const state = createStore();

vscode.postMessage('get_state');

window.addEventListener('message', (event) => {
	const { command, data } = event.data;
	if (command === 'set_state') {
		state.update((s) => ({ ...s, ...data }));
	}
});

function createStore() {
	const { subscribe, set, update } = writable<ExtensionState>({
		properties: {
			API_BRANCH_NAME: '',
			UX_BRANCH_NAME: '',
			THEME: 'unimicro',
			LICENSING_API_BRANCH_NAME: '',
			LICENSING_FRONTEND_BRANCH_NAME: '',
			INTEGRATION_BRANCH_NAME: '',
			SIGNAL_BRANCH_NAME: '',
			JOBSERVER_BRANCH_NAME: '',
			UNIFILES_BRANCH_NAME: '',
			DATABASE_PREFIX: '',
			IIS_WEBSITE_NAME: 'pg1',
			IDENTITY: 'dev',
			INITIAL_MIGRATION: 'false'
		}
	});

	return {
		subscribe,
		update,
		set,
		setAuth: (username: string, token: string) => {
			update((state) => ({ ...state, auth: { username, token } }));
			state.save();
		},
		clearAuth: () => {
			update((state) => ({ ...state, auth: undefined }));
			state.save();
		},
		save: () => {
			const data = get(state);
			vscode.saveState(data);
		}
	};
}

import './app.css';
import App from './App.svelte';

const mode = (window as any).extensionMode;
console.log('mode', mode);

const app = new App({
	target: document.getElementById('webview-container')!,
	props: { mode }
});

export default app;

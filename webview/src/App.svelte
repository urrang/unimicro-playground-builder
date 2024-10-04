<script lang="ts">
	import { state } from './lib/state';
	import Auth from './lib/Auth.svelte';
	import BuildProperties from './lib/BuildProperties.svelte';
	import { vscode } from './lib/vscode-api';

	let authSectionOpen = false;

	function startBuild() {
		vscode.postMessage('start_build');
	}
</script>

{#if $state.auth}
	<details bind:open={authSectionOpen}>
		<summary>Jenkins authentication</summary>
		<Auth showClearButton on:authSaved={() => (authSectionOpen = false)} />
	</details>

	<BuildProperties />

	<footer>
		<button on:click={startBuild}>Build playground</button>
	</footer>
{:else}
	<Auth />
{/if}

<style>
	footer {
		/* position: sticky; */
		/* bottom: 0; */
		margin: 1rem 0;
		background: var(--vscode-editor-background);
	}

	details {
		margin: 1.5rem 0;
	}
</style>

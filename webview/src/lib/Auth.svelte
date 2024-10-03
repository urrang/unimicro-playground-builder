<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { state } from './state';

	export let showClearButton = false;

	let username = '';
	let token = '';

	const dispatch = createEventDispatcher();

	onMount(() => {
		return state.subscribe((s) => {
			if (s.auth) {
				username = s.auth.username;
				token = s.auth.token;
			}
		});
	});

	function onSubmit() {
		state.setAuth(username, token);
		dispatch('authSaved');
	}
</script>

<form on:submit|preventDefault={onSubmit}>
	<label>
		<span>Jenkins username</span>
		<input type="text" bind:value={username} />
	</label>

	<label>
		<span>Personal access token</span>
		<input type="password" bind:value={token} />
	</label>

	<div class="actions">
		{#if showClearButton}
			<button type="button" class="secondary" on:click={state.clearAuth}>Clear</button>
		{/if}
		<button type="submit">Save</button>
	</div>
</form>

<style>
	form {
		margin-top: 1rem;
	}

	.actions {
		display: flex;
		gap: 0.75rem;
	}
</style>

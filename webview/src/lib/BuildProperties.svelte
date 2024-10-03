<script lang="ts">
	import { playgrounds } from './playgrounds';
	import { state } from './state';
</script>

<form on:submit|preventDefault on:change={state.save}>
	<label>
		<span>Playground</span>
		<select bind:value={$state.properties.IIS_WEBSITE_NAME}>
			{#each playgrounds as playground (playground.value)}
				<option value={playground.value}>{playground.label}</option>
			{/each}
		</select>
	</label>

	<label>
		<span>Theme</span>
		<select bind:value={$state.properties.THEME}>
			<option value="unimicro">Unimicro</option>
			<option value="ext01">SB1</option>
			<option value="ext02">DNB</option>
			<option value="eika">Eika</option>
			<option value="sor">Sparebanken Sør</option>
			<option value="azets">Azets</option>
		</select>
	</label>

	<label>
		<span>API branch</span>
		<input type="text" bind:value={$state.properties.API_BRANCH_NAME} />
	</label>

	<label>
		<span>Frontend branch</span>
		<input type="text" bind:value={$state.properties.UX_BRANCH_NAME} />
	</label>

	<details>
		<summary>More options</summary>

		<label>
			<span>License API branch</span>
			<input type="text" bind:value={$state.properties.LICENSING_API_BRANCH_NAME} />
		</label>

		<label>
			<span>License frontend branch</span>
			<input type="text" bind:value={$state.properties.LICENSING_FRONTEND_BRANCH_NAME} />
		</label>

		<label>
			<span>Signal branch</span>
			<input type="text" bind:value={$state.properties.SIGNAL_BRANCH_NAME} />
		</label>

		<label>
			<span>Job server branch</span>
			<input type="text" bind:value={$state.properties.JOBSERVER_BRANCH_NAME} />
		</label>

		<label>
			<span>Files branch</span>
			<input type="text" bind:value={$state.properties.UNIFILES_BRANCH_NAME} />
		</label>

		<label>
			<span>Database prefix</span>
			<input type="text" bind:value={$state.properties.DATABASE_PREFIX} />
		</label>
	</details>
</form>

<style>
	summary {
		margin-bottom: 1rem;
	}
</style>

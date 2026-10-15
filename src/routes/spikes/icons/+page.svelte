<script lang="ts">
	import Icon from '#lib/ui/icons/Icon.svelte';
</script>

<svelte:head>
	<title>Icon preview · Grim-Games</title>
</svelte:head>

<!-- Labelled icons the settings e2e tests watch while changing icon style and text size. -->
<main>
	<h1>Icon preview</h1>
	<ul class="slots" aria-label="Icon preview">
		<li><Icon name="night" label="Night" /></li>
		<li><Icon name="day" label="Day" /></li>
		<li><Icon name="dead" label="Dead" /></li>
		<li><Icon name="ghostVote" label="Ghost vote" /></li>
		<li><Icon name="poisoned" label="Poisoned" /></li>
		<li><Icon name="demon" label="Demon" /></li>
	</ul>
</main>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
	.slots {
		display: flex;
		gap: var(--space-4);
		padding: 0;
		list-style: none;
		color: var(--heading);
		--icon-size: calc(2 * var(--u));
	}
</style>

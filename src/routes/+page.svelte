<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
</script>

<main>
	<h1>Grim-Games</h1>
	<p>A touch-first grimoire for Blood on the Clocktower. Under construction.</p>

	<ul class="slots" aria-label="Icon preview">
		<li><Icon name="night" label="Night" /></li>
		<li><Icon name="day" label="Day" /></li>
		<li><Icon name="dead" label="Dead" /></li>
		<li><Icon name="ghostVote" label="Ghost vote" /></li>
		<li><Icon name="poisoned" label="Poisoned" /></li>
		<li><Icon name="demon" label="Demon" /></li>
	</ul>

	<nav>
		<Button href={resolve('/spikes/seat-sheet')} icon="players">Seat sheet spike</Button>
	</nav>

	<p class="small">
		Not affiliated with The Pandemonium Institute. Blood on the Clocktower is a trademark of Steven
		Medway and The Pandemonium Institute.
	</p>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
	h1 {
		margin-top: 0;
		font-size: 2rem;
	}
	.slots {
		display: flex;
		gap: var(--space-4);
		margin: var(--space-5) 0;
		padding: 0;
		list-style: none;
		color: var(--heading);
		--icon-size: 2rem;
	}
	nav {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-bottom: var(--space-6);
	}
	.small {
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
</style>

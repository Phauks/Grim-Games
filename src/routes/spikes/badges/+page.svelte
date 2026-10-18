<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
</script>

<svelte:head>
	<title>Badges spike · {APP_NAME}</title>
</svelte:head>

<main>
	<h1>Pre-day reminders (preview)</h1>
	<p class="note">Sample sentences only; the real list comes from the rules engine. Tap a badge.</p>
	<ul>
		<li>
			<CharacterBadge characterId="witch" playerName="Sam" /> has chosen <CharacterBadge
				characterId="librarian"
				playerName="Alex"
			/>
		</li>
		<li><CharacterBadge characterId="saint" /> is alive</li>
		<li><CharacterBadge characterId="slayer" playerName="Jo" /> is poisoned</li>
		<li><CharacterBadge characterId="virgin" /> has not been nominated</li>
		<li><CharacterBadge characterId="gossip" /> may make a public statement</li>
		<li><CharacterBadge characterId="beggar" alignment="evil" /> is evil</li>
	</ul>
</main>

<style>
	main {
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-4, calc(1 * var(--u)));
	}
	h1 {
		font-family: var(--font-heading);
	}
	.note {
		color: var(--on-surface-muted);
	}
	ul {
		display: grid;
		gap: var(--space-3, calc(0.75 * var(--u)));
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2, calc(0.5 * var(--u)));
	}
</style>

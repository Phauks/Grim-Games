<script lang="ts">
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
</script>

<svelte:head>
	<title>Badges spike · Grim-Games</title>
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
		max-width: 40rem;
		margin: 0 auto;
		padding: var(--space-4, 1rem);
	}
	h1 {
		font-family: var(--font-display);
	}
	.note {
		color: var(--on-surface-muted);
	}
	ul {
		display: grid;
		gap: var(--space-3, 0.75rem);
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2, 0.5rem);
	}
</style>

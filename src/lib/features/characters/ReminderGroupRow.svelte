<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterToken from './CharacterToken.svelte';

	/**
	 * One character's reminder tokens in a reminders picker: its token and name, then its
	 * chips, which wrap. The board's "Reminders for Seat N" and a player's own grim alike;
	 * goes in a `ul`.
	 */
	interface Props {
		character: Character;
		/** The character's reminder chips. */
		children: Snippet;
	}

	let { character, children }: Props = $props();
</script>

<li class="group">
	<span class="who">
		<CharacterToken {character} size={32} />
		<!-- eslint-disable-next-line grim/names-as-badges -- caption beside its own token; a badge would repeat the icon -->
		<span class="name">{character.name}</span>
	</span>
	<span class="chips" role="group" aria-label={character.name}>{@render children()}</span>
</li>

<style>
	.group {
		display: grid;
		/* The chips column may shrink, so its chips wrap instead of widening the dialog. */
		grid-template-columns: minmax(calc(8 * var(--u)), 35%) minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		padding: calc(0.125 * var(--u)) 0;
		border-bottom: 1px solid var(--border);
	}
	.who {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
	}
	.name {
		overflow: hidden;
		font-family: var(--font-character);
		font-size: 0.85rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		padding: var(--space-1) 0;
	}
</style>

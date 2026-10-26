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
		/** Whose tokens; none for the generic ∞ tokens, named by `name`. */
		character?: Character;
		name?: string;
		/** The character's reminder chips. */
		children: Snippet;
	}

	let { character, name, children }: Props = $props();
	const title = $derived(character?.name ?? name ?? '');
</script>

<li class="group">
	<span class="who">
		{#if character}<CharacterToken {character} size={32} />{:else}<span
				class="blank"
				aria-hidden="true">∞</span
			>{/if}
		<!-- eslint-disable-next-line grim/names-as-badges -- caption beside its own token; a badge would repeat the icon -->
		<span class="name">{title}</span>
	</span>
	<span class="chips" role="group" aria-label={title}>{@render children()}</span>
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
	/* The generic tokens' mark, a blank token the size of a character's. */
	.blank {
		display: grid;
		flex: none;
		place-items: center;
		width: calc(2 * var(--u));
		height: calc(2 * var(--u));
		border: 1px dashed var(--on-reminder);
		border-radius: 50%;
		background: var(--reminder-face);
		color: var(--on-reminder);
		font-weight: 700;
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

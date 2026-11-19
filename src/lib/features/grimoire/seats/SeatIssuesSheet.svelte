<script lang="ts">
	import NoneState from '#lib/ui/primitives/NoneState.svelte';
	import type { CharacterLookup } from '#lib/core/model/index.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import type { SeatIssue } from '#lib/features/grimoire/board.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	/**
	 * What is wrong with a seat, in words (Trevor, 2026-11-15: the top-middle mark is "a generic
	 * error toggle, which we should make so you can tap to see what the issue is"). Opened from
	 * BoardSeats by a tap on the seat's warning mark; one row for each of its `seatIssues`.
	 */
	interface Props {
		open: boolean;
		/** The player's name, or "Seat N". */
		title: string;
		issues: readonly SeatIssue[];
		characters: CharacterLookup;
	}

	let { open = $bindable(), title, issues, characters }: Props = $props();
</script>

<Dialog bind:open {title} description="Seat issues">
	<ul class="list" data-testid="seat-issues">
		{#each issues as issue (`${issue.kind}:${issue.characterId}`)}
			{@const character = characters.get(issue.characterId)}
			<li>
				<span class="kind" aria-hidden="true"><Icon name="warning" /></span>
				{#if character}
					<CharacterPiece template="badge" characterId={character.id} {character} />
				{/if}
				<span class="words"
					>{character ? 'Not on the script' : `Unknown character: ${issue.characterId}`}</span
				>
			</li>
		{:else}
			<NoneState as="li" />
		{/each}
	</ul>
</Dialog>

<style>
	.list {
		display: grid;
		margin: var(--space-3) 0 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		border-bottom: 1px solid var(--border); /* px-ok: a hairline divider */
	}
	.words {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	/* The seat's own mark (SeatToken's .issues), so the two read as one. */
	.kind {
		display: grid;
		place-items: center;
		width: 1.75em;
		height: 1.75em;
		border-radius: 50%;
		background: var(--accent);
		color: var(--on-accent);
		--icon-size: 1.1em;
	}
</style>

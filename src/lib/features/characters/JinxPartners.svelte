<script lang="ts">
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterPiece from './CharacterPiece.svelte';

	/**
	 * The icons of the characters a character is jinxed with, small on its name band: one
	 * strip for the script's jinx mark (JinxMark) and Character selection (CharacterChoice),
	 * so both draw them alike (Trevor, 2026-11-02: one shared piece, not two by hand).
	 */
	interface Props {
		partners: readonly Character[];
		/** Overlapped in one fixed slot, so nothing beside them moves (Character selection). */
		stacked?: boolean;
	}

	let { partners, stacked = false }: Props = $props();
</script>

<span class="partners" data-stacked={stacked ? '' : undefined}
	>{#each partners as p (p.id)}<span class="partner" data-partner={p.id}
			><CharacterPiece template="icon" character={p} label="" /></span
		>{/each}</span
>

<style>
	.partners {
		display: inline-flex;
		align-items: center;
		gap: calc(0.125 * var(--u));
		min-width: 0;
	}
	.partner {
		flex: none;
		width: 1.3em;
		height: 1.3em;
		border-radius: 50%;
		background: var(--token-face);
	}
	/* A fixed slot: a second partner overlaps the first, so nothing beside it moves. */
	.partners[data-stacked] {
		display: flex;
		justify-content: center;
		gap: 0;
		width: 2em;
	}
	.partners[data-stacked] .partner {
		width: 1.4em;
		height: 1.4em;
	}
	.partners[data-stacked] > * + * {
		margin-inline-start: -0.8em;
	}
</style>

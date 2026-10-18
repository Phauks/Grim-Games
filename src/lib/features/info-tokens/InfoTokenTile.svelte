<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { plainText } from './bold.ts';
	import InfoTokenText from './InfoTokenText.svelte';

	interface Props {
		/** The card's text, with its formatting marks. */
		text: string;
		/** The accessible name, when it differs from the text (a character card's). */
		'aria-label'?: string;
		/** Characters the card belongs to, shown under its text. */
		owners?: readonly Character[];
		onchoose: () => void;
		/** Given, a + strip adds the card to the ones shown together. */
		onadd?: () => void;
		/** Buttons only some cards have (Edit and Delete on the Storyteller's own). */
		actions?: Snippet;
	}

	let { text, 'aria-label': label, owners = [], onchoose, onadd, actions }: Props = $props();

	const name = $derived(label ?? plainText(text));
</script>

<!--
	One card tile, the same for standard, custom and character cards (Trevor, 2026-10-16):
	only the extras differ, and they sit beside the shared card.
-->
<li class="tile">
	<button
		type="button"
		class="card"
		class:owned={owners.length > 0}
		aria-label={label}
		onclick={onchoose}
	>
		<!-- One inline box, so the card's flex layout keeps the spaces between runs. -->
		<span class="text"><InfoTokenText {text} /></span>
		{#if owners.length > 0}
			<span class="owners">
				{#each owners.slice(0, 2) as owner (owner.id)}<CharacterBadge
						characterId={owner.id}
						character={owner}
						interactive={false}
					/>{/each}{#if owners.length > 2}<span class="more">+{owners.length - 2}</span>{/if}
			</span>
		{/if}
	</button>
	{#if onadd}
		<span class="add">
			<IconButton icon="add" label={t('info-tokens.addNamed', { name })} onclick={onadd} />
		</span>
	{/if}
	{#if actions}
		<span class="actions">{@render actions()}</span>
	{/if}
</li>

<style>
	/* Every tile is the same size (Trevor, 2026-10-16); long text is cut to fit and shown
	   in full on the player's screen. */
	.tile {
		display: flex;
		align-items: stretch;
		height: calc(2 * var(--tap-target));
		border: 1px solid var(--border);
		border-radius: var(--card-radius);
		overflow: hidden;
	}
	/* The + that adds a card to the ones shown together: a strip at the tile's edge. */
	.add {
		display: grid;
		flex: none;
		border-inline-start: 1px solid var(--border);
	}
	.add :global(.icon-button) {
		height: 100%;
		color: inherit;
		border-radius: 0;
	}
	.actions {
		display: flex;
		flex-direction: column;
		flex: none;
	}
	.actions :global(.icon-button) {
		color: inherit;
		border-radius: 0;
	}
	/* With a mouse, Edit and Delete show only on hover or keyboard focus (Trevor,
	   2026-10-16); they keep their space, so nothing moves. Touch has no hover, so they
	   stay visible there. */
	@media (hover: hover) {
		.actions {
			opacity: 0;
			transition: opacity 0.15s;
		}
		.tile:hover .actions,
		.tile:focus-within .actions {
			opacity: 1;
		}
	}
	.card {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		padding: var(--space-1) var(--space-3);
		border: 0;
		background: none;
		color: inherit;
		font-family: var(--font-heading);
		font-size: 1.05rem;
		line-height: 1.25;
		text-align: left;
		overflow-wrap: anywhere;
		cursor: pointer;
	}
	/* A card that belongs to characters: its text, then the characters. */
	.card.owned {
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		gap: var(--space-1);
	}
	.card:hover {
		background: var(--surface-hover);
	}
	.text {
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		overflow: hidden;
	}
	.owners {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		font-size: 0.85rem;
	}
	.more {
		font-family: var(--font-body);
	}
</style>

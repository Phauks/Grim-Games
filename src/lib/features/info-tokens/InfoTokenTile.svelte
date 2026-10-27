<script lang="ts">
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import type { InfoTokenAsks } from '#lib/core/data/info-tokens.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { askBadges } from './asks.ts';
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
		/** What it asks for when shown, as icons in its corner (Trevor, 2026-10-18). */
		asks?: InfoTokenAsks;
		/** The quick card: used once, never saved, so it looks apart (Trevor, 2026-10-18). */
		quick?: boolean;
	}

	let {
		text,
		'aria-label': label,
		owners = [],
		onchoose,
		onadd,
		actions,
		asks,
		quick = false
	}: Props = $props();

	const name = $derived(label ?? plainText(text));
	const badges = $derived([
		...(quick ? [{ icon: 'quickCard' as const, label: t('info-tokens.quickAbout') }] : []),
		...askBadges(asks)
	]);
	// Read as the card's words, then its characters, though the characters show first.
	const spoken = $derived(
		owners.length
			? // eslint-disable-next-line grim/names-as-badges -- the button's spoken name, never shown; the badges show
				t('info-tokens.cardFor', { card: name, name: owners.map((o) => o.name).join(', ') })
			: name
	);
	const id = $props.id();
</script>

<!--
	One card tile, the same for standard, custom and character cards (Trevor, 2026-10-16):
	only the extras differ, and they sit beside the shared card.
-->
<li class="tile" class:quick>
	<button
		type="button"
		class="card"
		class:owned={owners.length > 0}
		data-asks={badges.length || undefined}
		aria-label={label ?? (badges.length || owners.length ? spoken : undefined)}
		aria-describedby={badges.length ? `${id}-asks` : undefined}
		onclick={onchoose}
	>
		<!-- The character first, then the card's words (Trevor, 2026-10-18). -->
		{#if owners.length > 0}
			<span class="owners">
				{#each owners.slice(0, 2) as owner (owner.id)}<CharacterBadge
						characterId={owner.id}
						character={owner}
						interactive={false}
					/>{/each}{#if owners.length > 2}<span class="more">+{owners.length - 2}</span>{/if}
			</span>
		{/if}
		<!-- One inline box, so the card's flex layout keeps the spaces between runs. -->
		<span class="text"><InfoTokenText {text} /></span>
		<!-- Before the tap, what the card will ask for: icons, each named by its words. -->
		{#if badges.length}
			<span class="asks" id="{id}-asks" data-testid="info-token-asks">
				{#each badges as badge (badge.icon)}
					<span class="ask" role="img" aria-label={badge.label} title={badge.label}
						><Icon name={badge.icon} />{#if badge.count}<span class="count" aria-hidden="true"
								><CountBadge count={badge.count} /></span
							>{/if}</span
					>
				{/each}
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
	/* Its own card colours, so a tile looks the same on the page and in a sheet (Trevor, 2026-10-18). */
	.tile {
		display: flex;
		align-items: stretch;
		height: calc(2 * var(--tap-target));
		border: 1px solid var(--border);
		background: var(--card-background);
		color: var(--on-surface);
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
		position: relative;
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
	/* A card that belongs to characters: the characters, then its text. */
	/* Room for the corner icons, the same on every tile that has them, so nothing moves. */
	.card[data-asks] {
		padding-inline-end: calc(var(--tap-target) + var(--space-2));
	}
	/* The quick card is not one of the saved ones: an accent edge, dashed like a draft. */
	.tile.quick {
		border: 2px dashed var(--accent);
	}
	/* The corner icons sit over the card's top end. */
	.asks {
		position: absolute;
		inset-block-start: var(--space-1);
		inset-inline-end: var(--space-1);
		display: flex;
		gap: var(--space-1);
		font-size: 0.85rem;
		line-height: 1;
		opacity: 0.8;
	}
	.ask {
		display: inline-flex;
		align-items: center;
		gap: 0.1em;
	}
	.count {
		display: flex;
		font-size: 0.8em;
	}
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
	/* Text and its characters share the tile's height: two lines, then the badges. */
	.card.owned .text {
		-webkit-line-clamp: 2;
		line-clamp: 2;
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

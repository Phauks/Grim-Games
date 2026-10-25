<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
	import CharacterBadge from './CharacterBadge.svelte';

	/**
	 * One entry headed by a character, laid out like a jinx (Trevor, 2026-10-16/17): the
	 * text-size badge as a coloured bar across the entry, the information indented under it.
	 * Jinxes, the day's announcements and its ability reminders all use it.
	 *
	 * With `footer` it is a card (Trevor, 2026-10-23, the day's character rows): the bar, the
	 * ability under it, then a lower part joined to it holding what is known about the ability
	 * and its button.
	 */
	interface Props {
		characterId?: CharacterId;
		alignment?: Alignment;
		playerName?: string;
		/** The bar's words when there is no character (a player with none yet). */
		label?: string;
		/** Controls on the bar's own line, after the badge (the day's Used button). */
		end?: Snippet;
		/** The card's lower part, joined under the body (the day's state and its button). */
		footer?: Snippet;
		children: Snippet;
	}

	let { characterId, alignment, playerName, label, end, footer, children }: Props = $props();
</script>

<div class="entry" data-card={footer ? '' : undefined}>
	<span class="bar"
		>{#if characterId}<CharacterBadge {characterId} {alignment} {playerName} />{:else}<span
				class="plain">{label}</span
			>{/if}{#if end}{@render end()}{/if}</span
	>
	<div class="body">{@render children()}</div>
	{#if footer}<div class="footer">{@render footer()}</div>{/if}
</div>

<style>
	.entry {
		padding: var(--space-2) 0;
		border-bottom: var(--card-border);
	}
	/* The controls wrap under the badge only when the line is too narrow (largest text). */
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
		margin-bottom: var(--space-1);
	}
	.bar :global(.badge) {
		display: flex;
		flex: 1 1 auto;
		min-width: 0;
	}
	.bar > :global(:not(.badge)) {
		flex: none;
	}
	.plain {
		display: block;
		padding: 0 var(--space-2);
		border: var(--card-border);
		border-radius: var(--radius-full);
		font-family: var(--font-player);
	}
	.body {
		padding-inline-start: var(--space-3);
	}
	/*
	 * A card: the footer a raised strip joined to its bottom. Its list draws the box and the
	 * dividers (Trevor, 2026-10-23: L44, rows with dividers, not boxes with gaps).
	 */
	.entry[data-card] {
		padding: var(--space-2) var(--space-2) 0;
		border-bottom: 0;
	}
	.entry[data-card] .body {
		padding-inline: var(--space-2);
		padding-bottom: var(--space-2);
	}
	/* Its end (the day's button) runs the strip's full height to its right edge (Trevor, 2026-10-24). */
	.footer {
		display: flex;
		align-items: stretch;
		gap: var(--space-2);
		min-height: var(--tap-target);
		margin-inline: calc(-1 * var(--space-2));
		padding: 0 0 0 var(--space-3);
		border-top: var(--card-border);
		/* A see-through tint of the text (the hover tint), so the list's edge still shows. */
		background: var(--surface-hover);
	}
</style>

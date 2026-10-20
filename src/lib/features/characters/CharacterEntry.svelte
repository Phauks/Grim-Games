<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Alignment, CharacterId } from '#lib/core/data/index.ts';
	import CharacterBadge from './CharacterBadge.svelte';

	/**
	 * One entry headed by a character, laid out like a jinx (Trevor, 2026-10-16/17): the
	 * text-size badge as a coloured bar across the entry, the information indented under it.
	 * Jinxes, the day's announcements and its ability reminders all use it.
	 */
	interface Props {
		characterId?: CharacterId;
		alignment?: Alignment;
		playerName?: string;
		/** The bar's words when there is no character (a player with none yet). */
		label?: string;
		/** Controls on the bar's own line, after the badge (the day's Used button). */
		end?: Snippet;
		children: Snippet;
	}

	let { characterId, alignment, playerName, label, end, children }: Props = $props();
</script>

<div class="entry">
	<span class="bar"
		>{#if characterId}<CharacterBadge {characterId} {alignment} {playerName} inline />{:else}<span
				class="plain">{label}</span
			>{/if}{#if end}{@render end()}{/if}</span
	>
	<div class="body">{@render children()}</div>
</div>

<style>
	.entry {
		padding: var(--space-2) 0;
		border-bottom: var(--card-border);
	}
	.bar {
		display: flex;
		gap: var(--space-2);
		align-items: center;
		margin-bottom: var(--space-1);
	}
	.bar :global(.badge) {
		display: flex;
		flex: 1;
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
</style>

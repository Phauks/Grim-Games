<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import type { CharacterLookup } from '#lib/core/model/index.ts';
	import type { InfoToken } from '#lib/core/data/info-tokens.ts';
	import {
		filledInfoToken,
		stepInfoTokens,
		type FilledInfoToken
	} from '#lib/core/rules/info-token-characters.ts';
	import InfoTokenTile from './InfoTokenTile.svelte';

	interface Props {
		/** The step's night text; the info tokens it names are offered, with any its rules offer. */
		text: string | undefined;
		/** The step's character, whose rules may fill in a card's characters. */
		character: Character;
		characters: CharacterLookup;
		/** The game's prep values, for a card filled with one (the Storm Catcher's named character). */
		prepValues?: Readonly<Record<string, string>>;
		/**
		 * A card was tapped: show it, asking for its characters first if it needs them. `filled`
		 * are the characters the step's rules fill in (Trevor, 2026-10-24: the Harpy's own token).
		 */
		onchoose: (token: InfoToken, filled?: FilledInfoToken) => void;
		/**
		 * One row of one-line cards with no heading: the night strip under the board, so a card
		 * is one tap from the board without opening the step (Trevor, 2026-11-02).
		 */
		compact?: boolean;
	}

	let { text, character, characters, prepValues, onchoose, compact = false }: Props = $props();

	const tokens = $derived(
		stepInfoTokens(character, text).map((token) => {
			const filled = token.asks?.characters
				? filledInfoToken(character, token.id, token.asks.characters, prepValues)
				: undefined;
			const owners = (filled?.characterIds ?? []).flatMap((id) => {
				const c = characters.get(id);
				return c ? [c] : [];
			});
			return { token, filled, owners };
		})
	);
</script>

<!--
	The info tokens a night step's text names, ready to show (Trevor, 2026-10-19: the Snake
	Charmer's "You are"), with the characters its rules fill in on the tile. Nothing at all
	for a step that names none.
-->
{#if tokens.length > 0}
	{#if !compact}<h3>{t('info-tokens.title')}</h3>{/if}
	<ul
		class="cards"
		class:compact
		aria-label={compact ? t('info-tokens.title') : undefined}
		data-testid={compact ? 'strip-info-tokens' : 'step-info-tokens'}
	>
		{#each tokens as { token, filled, owners } (token.id)}
			<InfoTokenTile
				text={token.text}
				asks={token.asks}
				{owners}
				{compact}
				onchoose={() => onchoose(token, filled)}
			/>
		{/each}
	</ul>
{/if}

<style>
	.cards {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, calc(12 * var(--u))), 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/*
	 * Side by side, each as wide as its words. When the row is short of room, a grid shares
	 * it out evenly, so a short card ("You are") stays whole and a long one is cut.
	 */
	.cards.compact {
		grid-auto-flow: column;
		grid-auto-columns: minmax(0, max-content);
		grid-template-columns: none;
		justify-content: start;
		gap: var(--space-1);
		min-width: 0;
	}
</style>

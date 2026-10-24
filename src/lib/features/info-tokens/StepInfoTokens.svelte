<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import type { CharacterLookup } from '#lib/core/model/index.ts';
	import { infoTokensNamedIn, type InfoToken } from '#lib/core/data/info-tokens.ts';
	import { filledInfoToken, type FilledInfoToken } from '#lib/core/rules/info-token-characters.ts';
	import InfoTokenTile from './InfoTokenTile.svelte';

	interface Props {
		/** The step's night text; the info tokens it names are offered. */
		text: string | undefined;
		/** The step's character, whose rules may fill in a card's characters. */
		character: Character;
		characters: CharacterLookup;
		/**
		 * A card was tapped: show it, asking for its characters first if it needs them. `filled`
		 * are the characters the step's rules fill in (Trevor, 2026-10-24: the Harpy's own token).
		 */
		onchoose: (token: InfoToken, filled?: FilledInfoToken) => void;
	}

	let { text, character, characters, onchoose }: Props = $props();

	const tokens = $derived(
		infoTokensNamedIn(text).map((token) => {
			const filled = token.asks?.characters
				? filledInfoToken(character, token.id, token.asks.characters)
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
	<h3>{t('info-tokens.title')}</h3>
	<ul class="cards" data-testid="step-info-tokens">
		{#each tokens as { token, filled, owners } (token.id)}
			<InfoTokenTile
				text={token.text}
				asks={token.asks}
				{owners}
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
</style>

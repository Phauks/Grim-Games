<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { CharacterLookup } from '#lib/core/model/index.ts';
	import type { InfoToken } from '#lib/core/data/info-tokens.ts';
	import type { FilledInfoToken, StepCard } from '#lib/core/rules/night/info-token-characters.ts';
	import InfoTokenTile from './InfoTokenTile.svelte';

	interface Props {
		/**
		 * The step's cards no line of its text shows (`cardsOnLines`): the ones its rules offer
		 * besides those its text names (the Cerenovus's "You are mad as").
		 */
		cards: readonly StepCard[];
		characters: CharacterLookup;
		/**
		 * A card was tapped: show it, asking for its characters first if it needs them. `filled`
		 * are the characters the step's rules fill in (Trevor, 2026-10-24: the Harpy's own token).
		 */
		onchoose: (token: InfoToken, filled?: FilledInfoToken) => void;
	}

	let { cards, characters, onchoose }: Props = $props();

	const tokens = $derived(
		cards.map(({ token, filled }, i) => {
			const owners = (filled?.characterIds ?? []).flatMap((id) => {
				const c = characters.get(id);
				return c ? [c] : [];
			});
			return { key: `${token.id}:${i}`, token, filled, owners };
		})
	);
</script>

<!--
	The info tokens a night step offers beyond those on its text's lines, ready to show, with
	the characters its rules fill in on the tile. Nothing at all for a step with none.
-->
{#if tokens.length > 0}
	<h3>{t('info-tokens.title')}</h3>
	<ul class="cards" data-testid="step-info-tokens">
		{#each tokens as { key, token, filled, owners } (key)}
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

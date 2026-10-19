<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { infoTokensNamedIn, type InfoToken } from '#lib/core/data/info-tokens.ts';
	import InfoTokenTile from './InfoTokenTile.svelte';

	interface Props {
		/** The step's night text; the info tokens it names are offered. */
		text: string | undefined;
		/** A card was tapped: show it, asking for its characters first if it needs them. */
		onchoose: (token: InfoToken) => void;
	}

	let { text, onchoose }: Props = $props();

	const tokens = $derived(infoTokensNamedIn(text));
</script>

<!--
	The info tokens a night step's text names, ready to show (Trevor, 2026-10-19: the Snake
	Charmer's "You are"). Nothing at all for a step that names none.
-->
{#if tokens.length > 0}
	<h3>{t('info-tokens.title')}</h3>
	<ul class="cards" data-testid="step-info-tokens">
		{#each tokens as token (token.id)}
			<InfoTokenTile text={token.text} asks={token.asks} onchoose={() => onchoose(token)} />
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

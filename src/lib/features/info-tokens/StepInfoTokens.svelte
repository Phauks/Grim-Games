<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { CharacterLookup, Game } from '#lib/core/model/index.ts';
	import type { InfoToken } from '#lib/core/data/info-tokens.ts';
	import type { InfoTokenCharacterRules } from '#lib/core/data/info-token-rules.ts';
	import { stepInfoCards, type FilledInfoToken } from '#lib/core/rules/info-token-characters.ts';
	import InfoTokenTile from './InfoTokenTile.svelte';

	interface Props {
		/** The step's night text; the info tokens it names are offered, with any its rules offer. */
		text: string | undefined;
		/** The step's character, whose rules may fill in a card's characters. */
		character: Character;
		characters: CharacterLookup;
		/**
		 * The game: its prep values (the Storm Catcher's named character), its Demon, and who
		 * carries a reminder (the Apprentice's), for the cards filled from them.
		 */
		game?: Game;
		/** The characters this step changed players into tonight, the latest last. */
		changed?: readonly CharacterId[];
		/** The step's own fills, which win over its character's (a changed character's wake). */
		own?: InfoTokenCharacterRules;
		/**
		 * A card was tapped: show it, asking for its characters first if it needs them. `filled`
		 * are the characters the step's rules fill in (Trevor, 2026-10-24: the Harpy's own token).
		 */
		onchoose: (token: InfoToken, filled?: FilledInfoToken) => void;
	}

	let { text, character, characters, game, changed, own, onchoose }: Props = $props();

	const tokens = $derived(
		stepInfoCards(
			character,
			text,
			{ prepValues: game?.prepValues, game, characters, changed },
			own
		).map(({ token, filled }, i) => {
			const owners = (filled?.characterIds ?? []).flatMap((id) => {
				const c = characters.get(id);
				return c ? [c] : [];
			});
			return { key: `${token.id}:${i}`, token, filled, owners };
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

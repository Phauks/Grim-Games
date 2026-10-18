<script lang="ts">
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { InfoToken } from '#lib/core/data/info-tokens.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import CharacterPicker from '#lib/features/show/CharacterPicker.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import { characterCardsFor } from './character-cards.ts';
	import InfoTokenList from './InfoTokenList.svelte';
	import ChainBar from './ChainBar.svelte';
	import type { ChainCard } from './chain.ts';
	import { tokenTitle } from './token-title.ts';

	interface Props {
		/** Characters the Storyteller can show with a card, in script order. */
		characters: readonly Character[];
		/** `custom`: only the user's own cards (the Library). */
		only?: 'custom';
		/** Heading level of the card sections. */
		level?: 2 | 3;
	}

	let { characters, only, level = 2 }: Props = $props();

	let showOpen = $state(false);
	let shown = $state<ChainCard[]>([]);
	let pickOpen = $state(false);
	let picking = $state<InfoToken>();
	let picked = $state<CharacterId[]>([]);
	/**
	 * A card's + adds it to the cards shown together, as in the board's sheet (Trevor,
	 * 2026-10-18); `adding` is true while such a card's characters are being chosen.
	 */
	let adding = $state(false);
	let chainCards = $state<ChainCard[]>([]);

	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const shownCards = $derived(
		shown.map((card) => ({
			title: card.text,
			detail: card.detail,
			characters: card.characterIds.flatMap((id) => {
				const character = byId.get(id);
				return character ? [{ character }] : [];
			})
		}))
	);

	// With no game open, every character's cards are listed (Trevor, 2026-10-16).
	const characterCards = $derived(
		characterCardsFor(characters.map((c) => c.id)).flatMap((card) => {
			const character = byId.get(card.characterId);
			return character ? [{ card, character }] : [];
		})
	);

	/** Shows the card now, or adds it to the cards to show together. */
	function use(text: string, characterIds: CharacterId[] = [], detail?: string) {
		const card = { text, characterIds, detail };
		if (adding) chainCards = [...chainCards, card];
		else show([card]);
		adding = false;
	}

	function show(cards: ChainCard[]) {
		if (cards.length === 0) return;
		shown = cards;
		showOpen = true;
	}

	/** What was filled into a fill-in card, kept while its characters are chosen. */
	let pickingDetail = $state<string>();

	function choose(token: InfoToken, add: boolean, detail?: string) {
		adding = add;
		// Player cards ("This is the Demon") are shown at once: the Storyteller points.
		if (!token.asks?.characters) return use(token.text, [], detail);
		picking = token;
		pickingDetail = detail;
		picked = [];
		pickOpen = true;
	}
</script>

<!-- The player view sits outside the boundary, so a crash here never closes it. -->
<ErrorBoundary area="info-tokens">
	<div class="panel">
		<InfoTokenList
			onchoose={(token, detail) => choose(token, false, detail)}
			onadd={(token, detail) => choose(token, true, detail)}
			{only}
			{level}
			{characterCards}
			{characters}
			onchooseCharacter={({ title, detail, add }) => {
				adding = add;
				use(title, [], detail);
			}}
		/>
		<ChainBar bind:cards={chainCards} {characters} onshow={() => show(chainCards)} />
	</div>

	<BottomSheet bind:open={pickOpen} title={picking ? tokenTitle(picking) : ''} height="85dvh">
		{#if picking}
			<CharacterPicker
				{characters}
				bind:selected={picked}
				max={picking.asks?.characters ?? 1}
				label={t('info-tokens.characters')}
				notInPlay={picking.asks?.notInPlay === true}
			/>
			<ModalActions
				onCancel={() => {
					pickOpen = false;
					adding = false;
				}}
				disabled={picked.length === 0}
				onConfirm={() => {
					pickOpen = false;
					if (picking) use(picking.text, picked, pickingDetail);
				}}
			/>
		{/if}
	</BottomSheet>
</ErrorBoundary>

<ShowToPlayer bind:open={showOpen} cards={shownCards} />

<style>
	/* The cards to show sit over the page's bottom edge, in the page's own colour. */
	.panel {
		--chain-background: var(--surface);
	}
</style>

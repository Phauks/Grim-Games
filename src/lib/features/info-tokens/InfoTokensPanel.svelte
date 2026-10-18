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
	let shown = $state<{ text: string; characterIds: CharacterId[]; detail?: string }>({
		text: '',
		characterIds: []
	});
	let pickOpen = $state(false);
	let picking = $state<InfoToken>();
	let picked = $state<CharacterId[]>([]);

	const byId = $derived(new Map(characters.map((c) => [c.id, c])));
	const shownCharacters = $derived(
		shown.characterIds.flatMap((id) => {
			const character = byId.get(id);
			return character ? [{ character }] : [];
		})
	);

	// With no game open, every character's cards are listed (Trevor, 2026-10-16).
	const characterCards = $derived(
		characterCardsFor(characters.map((c) => c.id)).flatMap((card) => {
			const character = byId.get(card.characterId);
			return character ? [{ card, character }] : [];
		})
	);

	function show(text: string, characterIds: CharacterId[] = [], detail?: string) {
		shown = { text, characterIds, detail };
		showOpen = true;
	}

	/** What was filled into a fill-in custom card, kept while its characters are chosen. */
	let pickingDetail = $state<string>();

	function choose(token: InfoToken, detail?: string) {
		// Player cards ("This is the Demon") are shown at once: the Storyteller points.
		if (!token.asks?.characters) return show(token.text, [], detail);
		picking = token;
		pickingDetail = detail;
		picked = [];
		pickOpen = true;
	}
</script>

<!-- The player view sits outside the boundary, so a crash here never closes it. -->
<ErrorBoundary area="info-tokens">
	<InfoTokenList
		onchoose={choose}
		{only}
		{level}
		{characterCards}
		{characters}
		onchooseCharacter={({ title, detail }) => show(title, [], detail)}
	/>

	<BottomSheet bind:open={pickOpen} title={picking ? tokenTitle(picking) : ''} height="85dvh">
		{#if picking}
			<CharacterPicker
				{characters}
				bind:selected={picked}
				max={picking.asks?.characters ?? 1}
				label={t('info-tokens.characters')}
				notInPlay={picking.id === 'not-in-play'}
			/>
			<ModalActions
				onCancel={() => (pickOpen = false)}
				disabled={picked.length === 0}
				onConfirm={() => {
					pickOpen = false;
					if (picking) show(picking.text, picked, pickingDetail);
				}}
			/>
		{/if}
	</BottomSheet>
</ErrorBoundary>

<ShowToPlayer
	bind:open={showOpen}
	cards={[{ title: shown.text, characters: shownCharacters, detail: shown.detail }]}
/>

<style>
</style>

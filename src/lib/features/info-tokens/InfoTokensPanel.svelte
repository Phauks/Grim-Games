<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { InfoToken } from '#lib/core/data/info-tokens.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import CharacterPicker from '#lib/features/show/CharacterPicker.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { characterCardsFor } from './character-cards.ts';
	import InfoTokenList from './InfoTokenList.svelte';
	import { pickMax } from './pick.ts';

	interface Props {
		/** Characters the Storyteller can show with a card, in script order. */
		characters: readonly Character[];
	}

	let { characters }: Props = $props();

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

	function choose(token: InfoToken) {
		// Player cards ("This is the Demon") are shown at once: the Storyteller points.
		if (token.shows !== 'characters') return show(token.text);
		picking = token;
		picked = [];
		pickOpen = true;
	}
</script>

<!-- The player view sits outside the boundary, so a crash here never closes it. -->
<ErrorBoundary area="info-tokens">
	<InfoTokenList
		onchoose={choose}
		{characterCards}
		onchooseCharacter={({ title, detail }) => show(title, [], detail)}
	/>

	<BottomSheet bind:open={pickOpen} title={picking?.text ?? ''} height="85dvh">
		{#if picking}
			<CharacterPicker
				{characters}
				bind:selected={picked}
				max={pickMax(picking.id)}
				label={t('info-tokens.characters')}
			/>
			<div class="sheet-actions">
				<Button variant="quiet" onclick={() => (pickOpen = false)}>{t('common.cancel')}</Button>
				<Button
					variant="accent"
					icon="forward"
					onclick={() => {
						pickOpen = false;
						if (picking) show(picking.text, picked);
					}}>{t('info-tokens.show')}</Button
				>
			</div>
		{/if}
	</BottomSheet>
</ErrorBoundary>

<ShowToPlayer
	bind:open={showOpen}
	cards={[{ title: shown.text, characters: shownCharacters, detail: shown.detail }]}
/>

<style>
	.sheet-actions {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: flex-end;
		gap: var(--space-2);
		padding-top: var(--space-3);
		background: var(--sheet-background);
	}
</style>

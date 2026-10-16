<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { InfoToken } from '#lib/core/data/info-tokens.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import CharacterPicker from '#lib/features/show/CharacterPicker.svelte';
	import ShowToPlayer from '#lib/features/show/ShowToPlayer.svelte';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import InfoTokenList from './InfoTokenList.svelte';
	import { pickMax } from './pick.ts';

	interface Props {
		/** Characters the Storyteller can show with a card, in script order. */
		characters: readonly Character[];
	}

	let { characters }: Props = $props();

	let showOpen = $state(false);
	let shown = $state<{ text: string; characterIds: CharacterId[] }>({ text: '', characterIds: [] });
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

	function show(text: string, characterIds: CharacterId[] = []) {
		shown = { text, characterIds };
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
	<InfoTokenList onchoose={choose} />

	<BottomSheet bind:open={pickOpen} title={picking?.text ?? ''} height="85dvh">
		{#if picking}
			<CharacterPicker
				{characters}
				bind:selected={picked}
				max={pickMax(picking.id)}
				label="Characters"
			/>
			<div class="sheet-actions">
				<Button variant="quiet" onclick={() => (pickOpen = false)}>Cancel</Button>
				<Button
					variant="accent"
					icon="forward"
					onclick={() => {
						pickOpen = false;
						if (picking) show(picking.text, picked);
					}}>Show</Button
				>
			</div>
		{/if}
	</BottomSheet>
</ErrorBoundary>

<ShowToPlayer bind:open={showOpen} title={shown.text} characters={shownCharacters} />

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

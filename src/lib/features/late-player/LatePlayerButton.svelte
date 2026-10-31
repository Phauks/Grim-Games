<script lang="ts">
	/*
	 * The bag draw's Add late player (Trevor, 2026-10-30): its button and modal. Choose seat
	 * goes to the grimoire to tap where that player sits, and the modal opens again there
	 * (LateSeatOnBoard).
	 */
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { fromScript, type Character, type CharacterId } from '#lib/core/data/index.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import type { Game } from '#lib/core/model/index.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import LateSeatDialog from './LateSeatDialog.svelte';
	import { lateDraft } from './late-draft.svelte.ts';
	import { latePlayerHref } from './late-player.ts';

	interface Props {
		game: Game;
		/** The game's own characters (homebrew included). */
		lookup?: ReadonlyMap<CharacterId, Character>;
		send: (command: Command) => boolean;
	}

	let { game, lookup, send }: Props = $props();

	let open = $state(false);
	onMount(() => void loadOfficialData());
	const script = $derived(
		officialData.current ? fromScript(game.script, officialData.current).script : undefined
	);
	const find = (id: CharacterId) => lookup?.get(id) ?? officialData.current?.byId.get(id);

	function choose(index: number) {
		lateDraft.placing = index;
		void goto(latePlayerHref(game.gameId));
	}
</script>

<!-- After night 1 starts a late arrival is a Traveller (https://wiki.bloodontheclocktower.com/Travellers). -->
<IconButton
	icon="latePlayer"
	label={t('latePlayer.button')}
	disabled={!game.bag || !script || game.pastDays.length > 0}
	data-testid="late-player"
	onclick={() => {
		lateDraft.start();
		open = true;
	}}
/>
{#if script && officialData.current}
	<LateSeatDialog
		bind:open
		bind:players={lateDraft.players}
		{game}
		onAddAnother={() => lateDraft.add()}
		onPlace={choose}
		scriptCharacters={script.characters}
		official={officialData.current.characters}
		lookup={find}
		{send}
	/>
{/if}

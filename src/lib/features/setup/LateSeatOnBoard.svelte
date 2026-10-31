<script lang="ts">
	/*
	 * Add late player on the grimoire (Trevor, 2026-10-30): the modal's Choose seat brings the
	 * Storyteller here to tap where that late player sits, and the modal opens again over the
	 * board with everything kept.
	 */
	import { fromScript } from '#lib/core/data/index.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import { resolve } from '$app/paths';
	import { replaceState } from '$app/navigation';
	import { onMount } from 'svelte';
	import LateSeatDialog from './LateSeatDialog.svelte';
	import { LATE_PLAYER_HASH } from './late-player.ts';
	import { lateDraft } from './late-draft.svelte.ts';

	interface Props {
		grimoire: Grimoire;
		/** The board's own Add a seat: tap between two players, then `add` runs with the spot. */
		place: (add: (position: number) => void) => void;
	}

	let { grimoire, place }: Props = $props();

	let open = $state(false);

	const game = $derived(grimoire.game);
	const script = $derived(
		officialData.current ? fromScript(game.script, officialData.current).script : undefined
	);
	const lookup = (id: string) =>
		grimoire.open.characters.get(id) ?? officialData.current?.byId.get(id);

	function choose(index: number) {
		open = false;
		place((position) => {
			const player = lateDraft.players[index];
			if (player) player.position = position;
			open = true;
		});
	}

	onMount(() => {
		void loadOfficialData();
		if (location.hash !== LATE_PLAYER_HASH) return;
		replaceState(resolve('/grimoire/[gameId]', { gameId: game.gameId }), {});
		if (!game.bag) return;
		if (!lateDraft.players.length) lateDraft.start();
		choose(lateDraft.placing ?? 0);
	});
</script>

{#if script && officialData.current}
	<LateSeatDialog
		bind:open
		bind:players={lateDraft.players}
		{game}
		onAddAnother={() => lateDraft.add()}
		onPlace={choose}
		scriptCharacters={script.characters}
		official={officialData.current.characters}
		{lookup}
		send={(command) => grimoire.run(command)}
	/>
{/if}

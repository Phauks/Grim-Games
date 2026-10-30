<script lang="ts">
	/*
	 * Add late player on the grimoire (Trevor, 2026-10-30): the bag draw's button opens the
	 * board ready to tap where the late player sits, so their seat is right from the start;
	 * Add another late player comes back here for the next one.
	 */
	import { fromScript } from '#lib/core/data/index.ts';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import { resolve } from '$app/paths';
	import { replaceState } from '$app/navigation';
	import { onMount } from 'svelte';
	import LateSeatDialog from './LateSeatDialog.svelte';
	import { LATE_PLAYER_HASH, type LatePlayer } from './late-player.ts';

	interface Props {
		grimoire: Grimoire;
		/** The board's own Add a seat: tap between two players, then `add` runs with the spot. */
		place: (add: (position: number) => void) => void;
	}

	let { grimoire, place }: Props = $props();

	let open = $state(false);
	let players = $state<LatePlayer[]>([]);
	let key = 0;

	const game = $derived(grimoire.game);
	const script = $derived(
		officialData.current ? fromScript(game.script, officialData.current).script : undefined
	);
	const lookup = (id: string) =>
		grimoire.open.characters.get(id) ?? officialData.current?.byId.get(id);

	function another() {
		open = false;
		place((position) => {
			players = [...players, { key: key++, position, name: '' }];
			open = true;
		});
	}

	onMount(() => {
		void loadOfficialData();
		if (location.hash !== LATE_PLAYER_HASH) return;
		replaceState(resolve('/grimoire/[gameId]', { gameId: game.gameId }), {});
		if (!game.bag) return;
		players = [];
		another();
	});
</script>

{#if script && officialData.current}
	<LateSeatDialog
		bind:open
		bind:players
		{game}
		onAddAnother={another}
		scriptCharacters={script.characters}
		official={officialData.current.characters}
		{lookup}
		send={(command) => grimoire.run(command)}
	/>
{/if}

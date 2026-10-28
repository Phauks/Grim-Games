<script lang="ts">
	import { MAX_DEALT_PLAYERS, MIN_PLAYERS } from '#lib/core/rules/distribution.ts';
	import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import { analyseSetup } from '#lib/core/rules/setup.ts';
	import CountsBar from '#lib/features/setup/CountsBar.svelte';
	import SetupTable from '#lib/features/setup/SetupTable.svelte';

	/** The character types dealt for each player count (the Players section of the sheet). */
	interface Props {
		/**
		 * Players dealt from the bag, when known (in a game): the seats set the count, so no
		 * other can be picked and only this table's numbers show (Trevor, 2026-10-27).
		 */
		players?: number;
		/** The most players the script is made for (Teensyville: 6); more are greyed out. */
		maxPlayers?: number;
		/** Travellers the town knows are in play, in a game. */
		travellers?: readonly Character[];
		/** The Fabled and Loric in play, in a game: the town knows their setup change. */
		ruleCharacters?: readonly Character[];
	}

	let { players, maxPlayers, travellers = [], ruleCharacters = [] }: Props = $props();
	// In a game only this table's numbers show, every one in a box (Trevor, 2026-10-27), with
	// what the town knows can change them: the Fabled and Loric, and the Travellers.
	const game = $derived(
		players === undefined
			? undefined
			: analyseSetup({
					players: players + travellers.length,
					travellers: travellers.length,
					inPlay: [...ruleCharacters, ...travellers]
				})
	);
	const counts = Array.from(
		{ length: MAX_DEALT_PLAYERS - MIN_PLAYERS + 1 },
		(_, i) => MIN_PLAYERS + i
	);
	// Outside a game, tapping a player count highlights its column; tapping it again clears
	// it (Trevor, 2026-10-16).
	const COUNT_KEY = 'grim-games:play:player-count';
	function storedCount(): number | undefined {
		const n = Number(readStoredText(COUNT_KEY));
		return counts.includes(n) ? n : undefined;
	}
	let chosen = $state<number | null>();
	const highlighted = $derived(chosen !== undefined ? (chosen ?? undefined) : storedCount());
	function choose(n: number) {
		chosen = highlighted === n ? null : n;
		// Private browsing or full storage: the choice lasts until the page closes.
		writeStoredText(COUNT_KEY, chosen === null ? undefined : String(chosen));
	}
</script>

<!-- In a game, the setup check's boxes; otherwise the same setup sheet table as setup and New
     game (Trevor, 2026-10-17). -->
{#if game}
	<CountsBar analysis={game} travellers={game.travellers} game {maxPlayers} />
{:else}
	<SetupTable players={highlighted} onPick={choose} {maxPlayers} />
{/if}

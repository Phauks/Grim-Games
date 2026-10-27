<script lang="ts">
	import { MAX_DEALT_PLAYERS, MIN_PLAYERS } from '#lib/core/rules/distribution.ts';
	import { readStoredText, writeStoredText } from '#lib/ui/stored.ts';
	import SetupTable from '#lib/features/setup/SetupTable.svelte';

	/** The character types dealt for each player count (the Players section of the sheet). */
	interface Props {
		/**
		 * Players at the table, when known (in a game): that column is highlighted and the
		 * others can't be picked, since the seats set the count (Trevor, 2026-10-27).
		 */
		players?: number;
		/** The most players the script is made for (Teensyville: 6); more are greyed out. */
		maxPlayers?: number;
	}

	let { players, maxPlayers }: Props = $props();
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
	const highlighted = $derived(
		players !== undefined
			? Math.min(players, MAX_DEALT_PLAYERS)
			: chosen !== undefined
				? (chosen ?? undefined)
				: storedCount()
	);
	function choose(n: number) {
		chosen = highlighted === n ? null : n;
		// Private browsing or full storage: the choice lasts until the page closes.
		writeStoredText(COUNT_KEY, chosen === null ? undefined : String(chosen));
	}
</script>

<!-- The same setup sheet table as setup and New game (Trevor, 2026-10-17). -->
<SetupTable
	players={highlighted}
	onPick={players === undefined ? choose : undefined}
	{maxPlayers}
/>

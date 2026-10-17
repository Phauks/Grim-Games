<script lang="ts">
	import { MAX_DEALT_PLAYERS, MIN_PLAYERS } from '#lib/core/rules/distribution.ts';
	import SetupTable from '#lib/features/setup/SetupTable.svelte';

	/** The character types dealt for each player count (the Players section of the sheet). */
	interface Props {
		/** Players at the table, when known (the board): that column starts highlighted. */
		players?: number;
	}

	let { players }: Props = $props();
	const counts = Array.from(
		{ length: MAX_DEALT_PLAYERS - MIN_PLAYERS + 1 },
		(_, i) => MIN_PLAYERS + i
	);
	// Tapping a player count highlights its column; tapping it again clears it (Trevor,
	// 2026-10-16). The board starts from its seat count and doesn't store a choice.
	const COUNT_KEY = 'grim-games:play:player-count';
	function storedCount(): number | undefined {
		try {
			const n = Number(globalThis.localStorage?.getItem(COUNT_KEY));
			return counts.includes(n) ? n : undefined;
		} catch {
			return undefined;
		}
	}
	let chosen = $state<number | null>();
	const highlighted = $derived(
		chosen !== undefined
			? (chosen ?? undefined)
			: players === undefined
				? storedCount()
				: Math.min(players, MAX_DEALT_PLAYERS)
	);
	function choose(n: number) {
		chosen = highlighted === n ? null : n;
		if (players !== undefined) return;
		try {
			if (chosen === null) globalThis.localStorage?.removeItem(COUNT_KEY);
			else globalThis.localStorage?.setItem(COUNT_KEY, String(chosen));
		} catch {
			// Private browsing or full storage: the choice lasts until the page closes.
		}
	}
</script>

<!-- The same setup sheet table as setup and New game (Trevor, 2026-10-17). -->
<SetupTable players={highlighted} onPick={choose} />

<script lang="ts">
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import type { PublicRule, PublicSeat } from '#lib/core/sync/public-projection.ts';
	import type { PlayerGrimTown } from './player-grim-town.ts';
	import PlayerGrim from './PlayerGrim.svelte';
	import PlayerNotes from './PlayerNotes.svelte';
	import PlayerScriptTabs from './PlayerScriptTabs.svelte';
	import type { TravellerInPlay } from './travellers-in-play.ts';

	/**
	 * The player screen's tabs, Script, Night, Grim and Notes, set up once: /play renders it, and
	 * so does the Storyteller's player view (the board's Script, the grim cover's Player view).
	 * Every choice about how a tab looks is made here, never by either host (Trevor, 2026-10-28:
	 * "It should be the same feature!!!!"), so a new player feature shows on both sides.
	 */
	interface Props {
		script: LoadedScript;
		/** Seats at the table; highlights that column of the Players breakdown. */
		players?: number;
		/** Characters on seats, in a game: Travellers and Jinxes start closed when none plays. */
		inPlay?: readonly string[];
		travellers?: readonly TravellerInPlay[];
		rules?: readonly PublicRule[];
		ruleCharacters?: readonly string[];
		/** The town as the table knows it, from the Storyteller's board; a phone reads its room. */
		town?: PlayerGrimTown & { guessKey: string };
		/** Where the notes are kept (`scriptKey`, `saved:<id>`, `game:<key>` or the cover's). */
		notesKey: string | undefined;
		tab?: string;
	}

	let {
		script,
		players,
		inPlay,
		travellers,
		rules,
		ruleCharacters,
		town,
		notesKey,
		tab = $bindable('script')
	}: Props = $props();

	const notesTown = $derived<{ seats: readonly PublicSeat[]; guessKey: string } | undefined>(
		town && { seats: town.seats, guessKey: town.guessKey }
	);
</script>

<PlayerScriptTabs {script} {players} {inPlay} {travellers} {rules} {ruleCharacters} bind:tab>
	{#snippet grim()}<PlayerGrim {script} {town} fullScreen />{/snippet}
	{#snippet notes()}<PlayerNotes {notesKey} town={notesTown} />{/snippet}
</PlayerScriptTabs>

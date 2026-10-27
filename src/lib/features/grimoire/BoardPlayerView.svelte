<script lang="ts">
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import { charactersInPlay, type CharacterLookup, type Game } from '#lib/core/model/index.ts';
	import {
		publicProjection,
		type PublicCorner,
		type PublicLook,
		type PublicSeatLayout
	} from '#lib/core/sync/public-projection.ts';
	import { gameSheetRules } from '#lib/features/modes/sheet-rules.ts';
	import { dealtSeats } from '#lib/features/modes/players-line.ts';
	import { scriptKey } from '#lib/features/player/notebook.ts';
	import PlayerGrim from '#lib/features/player/PlayerGrim.svelte';
	import PlayerNotes from '#lib/features/player/PlayerNotes.svelte';
	import PlayerScriptTabs from '#lib/features/player/PlayerScriptTabs.svelte';
	import {
		publicTravellerTest,
		travellersInPlay
	} from '#lib/features/player/travellers-in-play.ts';

	/**
	 * What players see on /play, drawn from the Storyteller's game: the script, the night order
	 * and the town as the table knows it, with notes and guesses as on /play. The board's Script
	 * dialog keeps the Storyteller's own (Trevor, 2026-10-23: "feature parity"); the grim cover
	 * keeps the table's, blank each time (Trevor, 2026-10-27: "As if they were within the app.
	 * We shouldn't even block notes").
	 */
	interface Props {
		game: Game;
		script: LoadedScript;
		characters: CharacterLookup;
		layout: PublicSeatLayout;
		corner: PublicCorner;
		look?: PublicLook;
		/** The board's own background picture, or the room it comes from (PlayerGrim). */
		picture?: Blob;
		pictureRoom?: string;
		/**
		 * Where notes and guesses are kept: the Storyteller's own unless given (the grim cover
		 * gives its table notebook, `tableNotebook`).
		 */
		notebook?: string;
	}

	let { game, script, characters, layout, corner, look, picture, pictureRoom, notebook }: Props =
		$props();

	const town = $derived(
		publicProjection(game, publicTravellerTest(game.gameId, characters), layout, corner, characters)
	);
	const guessKey = $derived(notebook ?? `storyteller:${game.gameId}`);
</script>

<PlayerScriptTabs
	{script}
	players={dealtSeats(town.seats).dealt}
	inPlay={charactersInPlay(game)}
	travellers={travellersInPlay(town.seats)}
	rules={gameSheetRules(game.gameId)}
	{notes}
>
	{#snippet grim()}<PlayerGrim
			{script}
			town={{
				seats: town.seats,
				layout: town.layout,
				storytellerName: town.storytellerName,
				corner: town.corner,
				look,
				picture,
				pictureRoom,
				guessKey
			}}
		/>{/snippet}
</PlayerScriptTabs>

{#snippet notes()}<PlayerNotes
		notesKey={notebook ?? scriptKey(script)}
		town={{ seats: town.seats, guessKey }}
	/>{/snippet}

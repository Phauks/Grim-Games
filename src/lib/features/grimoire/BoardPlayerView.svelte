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
	 * and the town as the table knows it. The board's Script dialog has it with the
	 * Storyteller's own notes and guesses (Trevor, 2026-10-23: "feature parity"); the grim cover
	 * without them, its grim only drawn (Trevor, 2026-10-27: "seeing player view (script, night
	 * order, public grim, not notes)").
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
		/** The Storyteller's own notes and guesses; false on the grim cover. */
		own?: boolean;
	}

	let {
		game,
		script,
		characters,
		layout,
		corner,
		look,
		picture,
		pictureRoom,
		own = true
	}: Props = $props();

	const town = $derived(
		publicProjection(game, publicTravellerTest(game.gameId, characters), layout, corner, characters)
	);
	const guessKey = $derived(`storyteller:${game.gameId}`);
</script>

<PlayerScriptTabs
	{script}
	players={dealtSeats(town.seats).dealt}
	inPlay={charactersInPlay(game)}
	travellers={travellersInPlay(town.seats)}
	rules={gameSheetRules(game.gameId)}
	notes={own ? notes : undefined}
>
	{#snippet grim()}<PlayerGrim
			{script}
			display={!own}
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
		notesKey={scriptKey(script)}
		town={{ seats: town.seats, guessKey }}
	/>{/snippet}

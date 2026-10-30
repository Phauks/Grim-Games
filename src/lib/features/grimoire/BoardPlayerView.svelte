<script lang="ts">
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import { charactersInPlay, type CharacterLookup, type Game } from '#lib/core/model/index.ts';
	import type {
		PublicCorner,
		PublicLook,
		PublicSeatLayout
	} from '#lib/core/sync/public-projection.ts';
	import { dealtSeats } from '#lib/features/modes/players-line.ts';
	import { scriptKey } from '#lib/features/player/notebook.ts';
	import PlayerScreen from '#lib/features/player/PlayerScreen.svelte';
	import PlayerStatusRow from '#lib/features/player/PlayerStatusRow.svelte';
	import { travellersInPlay } from '#lib/features/player/travellers-in-play.ts';
	import { seatRoles } from '#lib/core/sync/seat-roles.ts';
	import { gameOverText } from '#lib/features/room/game-over-text.ts';
	import YourCharacter from '#lib/features/room/YourCharacter.svelte';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { tableState } from '#lib/features/room/table-state.svelte.ts';

	/**
	 * What players see on /play, drawn from the Storyteller's game: where the game is up to and
	 * the day timer, the script, the night order and the town as the table knows it, with notes and guesses as on /play. The board's Script
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

	// The very state a phone in the room gets (Trevor, 2026-10-27: "Design it so that these
	// additions move in automatically"), so the status row and the town show what phones show.
	const town = $derived(tableState(roomHost(), game, characters, layout, corner));
	// Who is connected, as the room tells the Storyteller; with no room, nothing to say.
	const presence = $derived.by(() => {
		const host = roomHost();
		return host.code ? host.seatPresence : undefined;
	});
	const guessKey = $derived(notebook ?? `storyteller:${game.gameId}`);
	// The end of the game as the room tells phones (Trevor, 2026-10-30): "Game over" over the
	// tabs, and the final grimoire on the Grim tab once Share grim sends it.
	const ended = $derived.by(() => {
		const over = roomHost().ended;
		return over?.gameId === game.gameId ? over : undefined;
	});
	const final = $derived.by(() => {
		const host = roomHost();
		const shared = host.revealed;
		if (shared?.gameId !== game.gameId) return undefined;
		const { winner, reason } = ended ?? {};
		return {
			grimoire: shared.grimoire,
			ended: { ...(winner ? { winner } : {}), ...(reason ? { reason } : {}) },
			room: host.code ?? undefined
		};
	});
	// Your character as each seat's phone has it, while players may see theirs (Trevor,
	// 2026-10-30): the Storyteller picks a seat, then sees that seat's card.
	const roleSeats = $derived.by(() => {
		const shown = roomHost().rolesShown.gameId === game.gameId;
		const roles = shown ? seatRoles(game, characters) : {};
		return town.seats.map((seat) => ({
			seatId: seat.seatId,
			seatNumber: seat.seatNumber,
			name: seat.playerName,
			role: roles[seat.seatId]
		}));
	});
</script>

<!-- The row over the tabs, as on /play: where the game is up to and the day timer. -->
<PlayerStatusRow
	table={town}
	ended={!!ended}
	status={ended ? gameOverText(ended.winner) : undefined}
	{presence}
	unseatedNames={roomHost().unseatedInGame.flatMap((m) => (m.name ? [m.name] : []))}
/>
<!-- Its own row under the status line, as on /play. -->
<YourCharacter characters={script.characters} seats={roleSeats} />
<PlayerScreen
	{script}
	players={dealtSeats(town.seats).dealt}
	inPlay={charactersInPlay(game)}
	travellers={travellersInPlay(town.seats)}
	rules={town.rules}
	ruleCharacters={town.ruleCharacters}
	town={{
		seats: town.seats,
		layout: town.layout,
		storytellerName: town.storytellerName,
		storyteller: town.storyteller,
		corner: town.corner,
		look,
		picture,
		pictureRoom,
		guessKey,
		final
	}}
	notesKey={notebook ?? scriptKey(script)}
/>

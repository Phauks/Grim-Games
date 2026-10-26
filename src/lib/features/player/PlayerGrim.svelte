<script lang="ts">
	import SeatNoteMark from '#lib/ui/seating/SeatNoteMark.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { CharacterId, LoadedScript } from '#lib/core/data/index.ts';
	import type { PublicCorner, PublicSeat } from '#lib/core/sync/public-projection.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { gameKey, lastRoom } from '#lib/features/room/player.svelte.ts';
	import { releaseRoom, useRoom } from '#lib/features/room/room-connection.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import SharedBoard from '#lib/features/room/SharedBoard.svelte';
	import type { EndedGame } from '#lib/features/grimoire/device-notes.ts';
	import SeatDisc from '#lib/ui/seating/SeatDisc.svelte';
	import { seatFrame } from '#lib/core/frames/index.ts';
	import { boardLooks } from '#lib/features/grimoire/board-looks.svelte.ts';
	import BoardBackdrop from '#lib/features/grimoire/BoardBackdrop.svelte';
	import BoardCorner from '#lib/features/grimoire/BoardCorner.svelte';
	import {
		backgroundFor,
		readBackground,
		type BackgroundChoice
	} from '#lib/features/grimoire/backgrounds.ts';
	import { cornerObstacles, nameBoxes } from '#lib/features/grimoire/board-geometry.ts';
	import { cornerRoom } from '#lib/features/grimoire/corner-room.ts';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import { scriptLogo } from '#lib/core/data/script-logo.ts';
	import type { PublicSeatLayout } from '#lib/core/sync/public-projection.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { playerSettings } from './player-settings.svelte.ts';
	import {
		DEFAULT_SEAT_LAYOUT,
		keepInside,
		parseSeatLayout,
		seatPoints,
		seatTokenSize
	} from '#lib/ui/seating/seat-layout.ts';
	import {
		GENERIC_GUESSES,
		clearGuesses,
		cycleGuess,
		genericGuess,
		guessesOf,
		mainGuess,
		readGuesses,
		toggleGuess,
		travellerGuess,
		travellerTeam,
		readSelf,
		selfSeat,
		writeSelf,
		writeGuesses,
		type GenericGuess,
		type GuessMark,
		type Guesses
	} from './grim-guesses.ts';
	import GenericGuessToken from './GenericGuessToken.svelte';
	import GuessMarks from './GuessMarks.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import SeatNoteDialog from '#lib/ui/notes/SeatNoteDialog.svelte';
	import { seatNotes, setSeatNote } from './seat-notes.svelte.ts';
	import AlignmentPill from '#lib/features/grimoire/AlignmentPill.svelte';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import { tablePlayersLine } from '#lib/features/modes/players-line.ts';

	/**
	 * /play's Grim tab (Trevor, 2026-10-19): the town as everyone at the table knows it, from
	 * the live room this phone joined. Who is alive or dead, who has spent their ghost vote,
	 * and the Travellers the town was told about; nothing else, so it never says more than the
	 * table does. A tap puts the player's own guess of a seat's character on it, kept on this
	 * phone only. Drawn as the Storyteller's board is (plan J13): its background and vignette,
	 * the seats where the board has them, the script's logo and the corner's lines.
	 */
	interface Props {
		script: LoadedScript;
		/**
		 * The town as the table knows it, given by the Storyteller's board (Trevor, 2026-10-23:
		 * the board's Script shows every screen a player has); a phone reads its room instead.
		 */
		town?: {
			seats: readonly PublicSeat[];
			layout?: PublicSeatLayout;
			storytellerName?: string;
			corner?: PublicCorner;
			/** The board's own game, whose background this town shows. */
			gameId?: string;
			/** Where the guesses and seat notes are kept; a display keeps none. */
			guessKey?: string;
			/** The room's code for the corner, where it isn't this device's own room. */
			roomCode?: string;
		};
		/**
		 * A Public Town display (Trevor, 2026-10-26): the town as /play draws it, with nothing to
		 * tap and nothing of this device's own on it (no guesses, notes or "you").
		 */
		display?: boolean;
	}

	let { script, town, display = false }: Props = $props();

	// svelte-ignore state_referenced_locally
	const code = town ? (town.roomCode ?? town.guessKey) : lastRoom();
	// svelte-ignore state_referenced_locally
	const player = !town && code ? useRoom(code) : undefined;
	$effect(() => () => {
		if (player) releaseRoom(player);
	});

	const table = $derived(town ?? player?.view?.public);
	const seats = $derived(table?.seats ?? []);
	/** Where this game's guesses and seat notes are kept: per game (`gameKey`). */
	const kept = $derived(
		display ? undefined : town ? town.guessKey : code ? gameKey(code) : undefined
	);
	let guesses = $state<Guesses>({});
	/** The seat this player marked as theirs; else the one the room gave them. */
	let marked = $state<string>();
	const mine = $derived(selfSeat(marked, player?.view?.me.seatId));
	function markSelf(seatId: string, on: boolean) {
		if (!kept) return;
		marked = on ? seatId : '';
		writeSelf(kept, marked);
	}
	/** The player's own note on each seat (Trevor, 2026-10-24), shared with the Notes tab. */
	// Set in an effect, not a derived, so the derived below follows the notes it reads.
	let book = $state<ReturnType<typeof seatNotes>>();
	$effect.pre(() => {
		guesses = kept ? readGuesses(kept) : {};
		marked = kept ? readSelf(kept) : undefined;
		book = kept ? seatNotes(kept) : undefined;
	});
	const notes = $derived(book?.notes ?? {});
	let noteOpen = $state(false);

	/**
	 * The finished grimoire the Storyteller shared at game end (Share grim, R5), in place of
	 * the town until switched off (Trevor, 2026-10-24); its History steps through on this
	 * phone only.
	 */
	const final = $derived(player?.revealed);
	let showFinal = $state(true);
	let arrivedAt = $state(0);
	$effect(() => {
		if (final) arrivedAt = Date.now();
	});
	const over = $derived<EndedGame | undefined>(
		final ? ({ endedAt: arrivedAt, ...player?.view?.ended } as EndedGame) : undefined
	);

	const nameOf = (seat: PublicSeat) =>
		seat.playerName ?? t('common.seat', { number: seat.seatNumber });

	// The board's own layout, read like a saved one, so a bad one never stops the drawing.
	const layout = $derived(table?.layout ? parseSeatLayout(table.layout) : DEFAULT_SEAT_LAYOUT);
	let width = $state(0);
	let height = $state(0);
	const board = $derived({ width, height });
	const ids = $derived(seats.map((s) => s.seatId as string));
	const size = $derived(
		seatTokenSize(ids, layout, board, preferences.current.tokenAppearance.tokenScale)
	);
	// As on the board: each seat keeps one --u (16px) clear of the edge.
	const unit = 16;
	const points = $derived(keepInside(seatPoints(ids, layout, board), board, size / 2 + unit));

	/**
	 * The players and the split by type, worked out from the seats so nobody counts (Trevor,
	 * 2026-10-26, plan E1): the standard split, which is all the table can know. A line of its
	 * own over the town, so the corner keeps its room among the seats.
	 */
	const counts = $derived(tablePlayersLine(seats));

	// The corner's script name keeps clear of every seat and name, as on the board.
	let rootFont = $state(16);
	$effect(() => {
		void preferences.current;
		rootFont = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
	});
	const cornerBoxes = $derived(
		cornerObstacles(
			points,
			nameBoxes({ names: seats.map(nameOf), seats: points, size, unit, rootFont, board }),
			size,
			boardLooks.current.nameOffset,
			board
		)
	);
	const fitCorner = (h: number) => cornerRoom(cornerBoxes, board, h + 4, 4 + 8);

	// This device's background for the board: the game's own on the Storyteller's, else the
	// one for every game. The script's own image is only a web link (backgrounds.ts).
	let background = $state<BackgroundChoice>({ kind: 'none' });
	$effect(() => {
		const gameId = town?.gameId;
		(gameId ? backgroundFor(gameId) : readBackground('default'))
			.then((choice) => (background = choice ?? { kind: 'none' }))
			.catch(() => (background = { kind: 'none' }));
	});
	let backgroundUrl = $state<string | undefined>();
	$effect(() => {
		if (background.kind === 'image') {
			const url = URL.createObjectURL(background.image);
			backgroundUrl = url;
			return () => URL.revokeObjectURL(url);
		}
		const link = script.meta?.background ?? '';
		backgroundUrl = background.kind === 'script' && /^https:\/\//.test(link) ? link : undefined;
	});
	const logo = $derived(scriptLogo(script));
	let logoFailed = $state(false);

	const characterOf = (id: CharacterId | undefined) =>
		id === undefined
			? undefined
			: (script.characters.find((c) => c.id === id) ??
				officialData.current?.characters.find((c) => c.id === id));

	let open = $state(false);
	let chosen = $state<PublicSeat>();
	function choose(seat: PublicSeat, event?: MouseEvent) {
		chosen = seat;
		// The note mark opens the note itself, as the board's does (Trevor, 2026-10-25), and
		// the guess pill makes the next guess the main one.
		const target = event?.target instanceof Element ? event.target : null;
		if (target?.closest('.mark.note')) noteOpen = true;
		else if (target?.closest('[data-testid="guess-marks"]')) save(cycleGuess(guesses, seat.seatId));
		else open = true;
	}
	/** A generic guess's word: its character type, or Good or Evil. */
	const genericLabel = (g: GenericGuess) =>
		g.type ? TYPE_LABELS[g.type] : g.team === 'good' ? 'Good' : 'Evil';
	const guessName = (value: string | undefined) => {
		const generic = genericGuess(value);
		return generic ? genericLabel(generic) : characterOf(value)?.name;
	};

	function save(next: Guesses) {
		if (!kept) return;
		guesses = next;
		writeGuesses(kept, guesses);
	}
	/**
	 * A tap in the sheet adds a guess as the main one, or takes it off (up to three a seat,
	 * Trevor 2026-10-25); the sheet stays open so the next can be added.
	 */
	function guess(characterId: CharacterId) {
		if (!chosen) return;
		save(
			chosen.traveller
				? travellerGuess(guesses, chosen.seatId, characterId)
				: toggleGuess(guesses, chosen.seatId, characterId)
		);
	}
	/** Only Good or Evil for a Traveller's seat, whose character the town knows (Trevor, 2026-10-26). */
	const guessChoices = $derived(
		chosen?.traveller ? GENERIC_GUESSES.filter((g) => !g.type) : GENERIC_GUESSES
	);
	/** The seat's guesses, main first, as the token, its pill and the sheet show them. */
	const listed = (seatId: string) =>
		(seats.find((s) => s.seatId === seatId)?.traveller
			? guessesOf(guesses, seatId).filter(
					(id) => genericGuess(id)?.type === undefined && !!genericGuess(id)
				)
			: guessesOf(guesses, seatId)
		).map((id) => {
			const generic = genericGuess(id);
			return generic
				? { id, generic, label: genericLabel(generic) }
				: { id, character: characterOf(id) };
		});

	/* eslint-disable grim/names-as-badges -- the seat button's accessible name (aria-label) only */
	function label(seat: PublicSeat): string {
		const parts = [`${t('common.seat', { number: seat.seatNumber })}: ${nameOf(seat)}`];
		if (seat.seatId === mine) parts.push(t('player.grim.you'));
		if (seat.dead) parts.push(t('player.grim.dead'));
		if (seat.ghostVote === 'unused') parts.push(t('player.grim.voteUnused'));
		if (seat.ghostVote === 'used') parts.push(t('player.grim.voteUsed'));
		// No ghost vote to spend (the Banshee killed by the Demon), as the board says.
		if (seat.votes !== undefined) parts.push(t('player.grim.votes', { count: seat.votes }));
		const traveller = characterOf(seat.traveller);
		if (traveller) parts.push(t('player.grim.traveller', { name: traveller.name }));
		const guessed = listed(seat.seatId)
			.map((g) => guessName(g.id))
			.filter(Boolean);
		if (guessed.length) parts.push(t('player.grim.guess', { name: guessed.join(', ') }));
		if (notes[seat.seatId]) parts.push(t('player.grim.hasNote'));
		return parts.join(', ');
	}
	/* eslint-enable grim/names-as-badges */
</script>

<!-- Share grim (plan R5): only once the Storyteller shares the final grimoire, since it does
     nothing before (Trevor, 2026-10-25); the board's own copy of this tab has no such switch. -->
{#if !town && final}
	<div class="tools">
		<Toggle
			label={t('room.finalGrimoire')}
			checked={showFinal}
			onChange={(on) => (showFinal = on)}
		/>
	</div>
{/if}
{#if final && showFinal}
	<div class="final" data-testid="final-grimoire">
		<SharedBoard shared={final.grimoire} {over} />
	</div>
{:else if !code || seats.length === 0}
	<p class="none" data-testid="grim-none">{t('common.none')}</p>
{:else}
	<p class="counts" data-testid="grim-counts">{t('modes.info.players')}: {counts}</p>
	<div
		class="town"
		class:display
		bind:clientWidth={width}
		bind:clientHeight={height}
		style:--name-scale={boardLooks.current.nameSize}
		style:--name-offset={boardLooks.current.nameOffset}
		data-testid="player-grim"
	>
		<BoardBackdrop
			contained
			url={backgroundUrl}
			preset={background.kind === 'preset' ? background.id : undefined}
			vignette={boardLooks.current.vignette ? boardLooks.current.vignetteStrength : undefined}
		/>
		{#if boardLooks.current.logo && logo && !logoFailed}
			<ScriptLogo
				src={logo}
				class="town-logo"
				--logo-opacity={boardLooks.current.logoOpacity}
				onfail={() => (logoFailed = true)}
			/>
		{/if}
		{#each seats as seat, i (seat.seatId)}
			{@const point = points[i]}
			{@const known = characterOf(seat.traveller)}
			<!-- A Traveller's seat takes only an alignment, shown in its icon's colour. -->
			{@const team = known ? travellerTeam(guesses, seat.seatId)?.team : undefined}
			{@const main = known ? undefined : guessesOf(guesses, seat.seatId)[0]}
			{@const generic = genericGuess(main)}
			{@const guessed = generic ?? characterOf(main)}
			{@const others = (known ? [] : listed(seat.seatId))
				.slice(1)
				.flatMap((g): GuessMark[] =>
					g.generic
						? [{ generic: g.generic, label: g.label }]
						: g.character
							? [{ character: g.character }]
							: []
				)}
			<!-- The player's avatar unless their own guess is set to show over it (plan R6). -->
			{@const shown =
				known ?? (seat.avatar && !playerSettings.current.guessesOnTokens ? undefined : guessed)}
			<!-- A display's seats are only drawn: nothing on the table's tablet can be tapped. -->
			<svelte:element
				this={display ? 'div' : 'button'}
				type={display ? undefined : 'button'}
				role={display ? 'img' : undefined}
				class="seat"
				data-mine={seat.seatId === mine || undefined}
				data-guess={(!known && !!guessed && shown === guessed) || undefined}
				style:left="{point?.x ?? 50}%"
				style:top="{point?.y ?? 50}%"
				aria-label={label(seat)}
				data-testid="grim-seat"
				onclick={display ? undefined : (event: MouseEvent) => choose(seat, event)}
			>
				<SeatDisc
					{size}
					dead={seat.dead}
					name={nameOf(seat)}
					number={seat.seatNumber}
					face={shown ? face : undefined}
					vote={seat.ghostVote}
					avatar={seat.avatar}
					usedVote={boardLooks.current.usedGhostVote}
					frame={seatFrame(seat.frame, boardLooks.current.defaultFrame)}
					marks={notes[seat.seatId] || (others.length && shown === guessed) ? marks : undefined}
				/>
				{#snippet marks()}
					<!-- The board's own mark (SeatNoteMark): tapping it opens the note, as on the board. -->
					{#if notes[seat.seatId]}<SeatNoteMark />{/if}
					{#if others.length && shown === guessed}<GuessMarks {others} />{/if}
				{/snippet}
				{#snippet face()}
					{#if shown && 'key' in shown}<GenericGuessToken
							guess={shown}
							label={genericLabel(shown)}
							{size}
						/>{:else if shown}<CharacterToken
							character={shown}
							alignment={shown === known ? team : undefined}
							{size}
						/>{/if}
				{/snippet}
			</svelte:element>
		{/each}
		<!-- The board's corner, line for line as the Storyteller's board shows it (Trevor,
		     2026-10-24); nothing to open or share here. -->
		<BoardCorner
			meta={script.meta}
			storytellerName={table?.storytellerName}
			corner={table?.corner}
			roomCode={town ? (town.roomCode ?? roomHost().code) : code}
			logo={logo && !logoFailed ? logo : undefined}
			watching
			fitRoom={fitCorner}
			{width}
			{rootFont}
		/>
	</div>
{/if}

<BottomSheet
	bind:open
	title={chosen ? `${t('common.seat', { number: chosen.seatNumber })} · ${nameOf(chosen)}` : ''}
>
	<!-- This seat's guesses, main first, at the top (Trevor, 2026-10-25); a tap makes one the
	     main guess. Then the note, a row of its own, so the two never read as one. -->
	<div class="row" data-testid="seat-guesses">
		<span class="row-label">{t('player.grim.guesses')}</span>
		<ul class="chips" aria-label={t('player.grim.guesses')}>
			{#each chosen ? listed(chosen.seatId) : [] as g, i (g.id)}
				<li>
					<button
						type="button"
						class="chip"
						aria-pressed={i === 0}
						onclick={() => chosen && save(mainGuess(guesses, chosen.seatId, g.id))}
						>{#if g.generic}<AlignmentPill
								alignment={g.generic.team}
								text={g.label}
							/>{:else}<CharacterBadge
								characterId={g.id}
								character={g.character}
								interactive={false}
							/>{/if}</button
					>
				</li>
			{:else}
				<li class="row-none">{t('common.none')}</li>
			{/each}
		</ul>
	</div>
	<!-- The player's own note on this seat, as the Storyteller has one per player (Trevor,
	     2026-10-24); it shows on the Notes tab too. -->
	<button
		type="button"
		class="row seat-note"
		data-testid="seat-note"
		onclick={() => (noteOpen = true)}
		><span class="row-label">{t('player.note')}</span><span class="seat-note-text"
			>{(chosen && notes[chosen.seatId]) || t('common.none')}</span
		></button
	>
	<!-- Which seat is this player's own, for when the room did not seat them (Trevor,
	     2026-10-26); it glows on the grim. -->
	<SettingToggle
		label={t('player.grim.thisIsMe')}
		checked={!!chosen && chosen.seatId === mine}
		onChange={(on) => chosen && markSelf(chosen.seatId, on)}
	/>
	<!-- Also in Settings > Player: one switch for every seat. -->
	<SettingToggle
		label={t('player.guessesOnTokens')}
		checked={playerSettings.current.guessesOnTokens}
		onChange={(guessesOnTokens) => playerSettings.update({ guessesOnTokens })}
	/>
	<!-- A seat by its type alone, or only good or evil (Trevor, 2026-10-24), above the
	     characters; a Traveller's seat has only Good and Evil, and no characters. -->
	<ul class="generic" aria-label={t('player.grim.generic')}>
		{#each guessChoices as g (g.key)}
			<li>
				<button
					type="button"
					aria-pressed={!!chosen && guessesOf(guesses, chosen.seatId).includes(g.key)}
					data-guess-key={g.key}
					onclick={() => guess(g.key)}
					><AlignmentPill alignment={g.team} text={genericLabel(g)} /></button
				>
			</li>
		{/each}
	</ul>
	{#if !chosen?.traveller}<CharacterPicker
			characters={script.characters}
			selected={chosen ? guessesOf(guesses, chosen.seatId) : []}
			onSelect={(id) => guess(id)}
			onNone={() => chosen && save(clearGuesses(guesses, chosen.seatId))}
		/>{/if}
</BottomSheet>

<SeatNoteDialog
	bind:open={noteOpen}
	title={chosen ? t('player.grim.noteTitle', { name: nameOf(chosen) }) : ''}
	value={(chosen && notes[chosen.seatId]) || ''}
	onSave={(note) => kept && chosen && setSeatNote(kept, chosen.seatId, note)}
/>

<style>
	/* Guesses and Note: one labelled row each, with a line between them (Trevor: rows with
	   dividers), so a guess never reads as a note. */
	.row {
		display: grid;
		grid-template-columns: calc(6 * var(--u)) 1fr;
		align-items: center;
		gap: var(--space-2);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-1) 0;
		border-bottom: 1px solid var(--border);
	}
	.row-label {
		font-family: var(--font-control);
		font-weight: 600;
	}
	.seat-note {
		margin: 0 0 var(--space-2);
		border-width: 0 0 1px;
		border-radius: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	/* One line of up to three, so adding a guess moves nothing below it. */
	.chips {
		display: flex;
		gap: var(--space-1);
		min-width: 0;
		margin: 0;
		padding: 0;
		overflow: hidden;
		list-style: none;
	}
	.chip {
		display: grid;
		place-items: center;
		min-height: var(--tap-target);
		padding: 0 var(--space-1);
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		background: none;
		font: inherit;
		cursor: pointer;
	}
	/* The main guess, the one on the token. */
	.chip[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--surface-selected);
	}
	.row-none {
		color: var(--on-surface-muted);
	}
	.seat-note-text {
		overflow: hidden;
		color: var(--on-surface-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* Two rows of three on a phone, one row where there is room. */
	.generic {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(30%, calc(7 * var(--u))), 1fr));
		gap: var(--space-1);
		margin: 0 0 var(--space-2);
		padding: 0;
		list-style: none;
	}
	.generic button {
		display: grid;
		place-items: center;
		width: 100%;
		min-height: var(--tap-target);
		padding: 0 var(--space-1);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		font: inherit;
		touch-action: manipulation;
		cursor: pointer;
	}
	.generic button[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--surface-selected);
	}
	.tools {
		display: flex;
		justify-content: flex-end;
		margin-bottom: var(--space-2);
	}
	/* The Storyteller's board, with room under it for History's Previous and Next. */
	.final {
		position: relative;
		height: 75dvh;
		margin-bottom: calc(2 * var(--tray-h, var(--tap-target)));
	}
	.counts {
		margin: 0 0 var(--space-2);
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	/* The board's shape (plan J13): the screen's width, and most of its height, so the seats
	   sit as they do on the Storyteller's board, tall on a phone and wide on a tablet. */
	.town {
		position: relative;
		/* The backdrop and vignette sit under the seats, inside the town (BoardBackdrop). */
		isolation: isolate;
		overflow: hidden;
		border-radius: var(--radius-md);
		width: 100%;
		height: 75dvh;
	}
	.display .seat {
		cursor: default;
	}
	/* Faint behind the seats, as on the board. */
	.town :global(.town-logo) {
		position: absolute;
		left: 50%;
		top: 50%;
		width: 42%;
		height: 42%;
		translate: -50% -50%;
		opacity: var(--logo-opacity);
		pointer-events: none;
	}
	.seat {
		position: absolute;
		display: grid;
		justify-items: center;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		transform: translate(-50%, -50%);
		cursor: pointer;
	}
	/* Your own seat glows (Trevor, 2026-10-26: "special glow or effect on self in grim"),
	   breathing slowly unless motion is reduced. In the text colour, not the accent, since red
	   or blue would read as an alignment (the accent is red in some themes). */
	.seat[data-mine] :global(.disc) {
		outline: calc(0.2 * var(--u)) solid var(--on-surface);
		outline-offset: calc(0.2 * var(--u));
		border-radius: 50%;
		box-shadow: 0 0 calc(1.25 * var(--u)) calc(0.5 * var(--u)) var(--on-surface);
		animation: self-glow 2.4s ease-in-out infinite;
	}
	@keyframes self-glow {
		50% {
			box-shadow: 0 0 calc(0.6 * var(--u)) calc(0.2 * var(--u)) var(--on-surface);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.seat[data-mine] :global(.disc) {
			animation: none;
		}
	}
	/* A guess is the player's own, so it never looks like something the town was told. */
	.seat[data-guess] :global(.face) {
		opacity: 0.75;
		outline: calc(0.15 * var(--u)) dashed var(--on-surface-muted);
		outline-offset: calc(0.1 * var(--u));
	}
</style>

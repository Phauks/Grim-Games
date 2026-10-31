<script lang="ts">
	import type { Snippet } from 'svelte';
	import SeatNoteMark from '#lib/ui/seating/SeatNoteMark.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { CharacterId, LoadedScript } from '#lib/core/data/index.ts';
	import { parsePublicLook, type PublicSeat } from '#lib/core/sync/public-projection.ts';
	import { finalGrimoireOf, type PlayerGrimTown } from './player-grim-town.ts';
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
	import { drawnLook } from '#lib/features/grimoire/shared-look.ts';
	import { roomImagePath } from '#lib/core/sync/room-images.ts';
	import { screenTheme, themeColours } from '#lib/ui/themes/screen-theme.svelte.ts';
	import { cornerFit, cornerObstacles, nameBoxes } from '#lib/features/grimoire/board-geometry.ts';
	import { watchRootFont } from '#lib/ui/root-font.svelte.ts';
	import PlayerSeatReminders from './PlayerSeatReminders.svelte';
	import PlayerSeating from './PlayerSeating.svelte';
	import BoardReminder from '#lib/features/grimoire/BoardReminder.svelte';
	import ReminderTokenRow from '#lib/features/grimoire/ReminderTokenRow.svelte';
	import { playerLook, reminderChip, reminderWords, remindersOn } from './player-reminders.ts';
	import { PlayerReminderState } from './player-reminders.svelte.ts';
	import PlayerReminderPicker from './PlayerReminderPicker.svelte';
	import PlayerReminderBin from './PlayerReminderBin.svelte';
	import BoardLogo from '#lib/features/scripts/BoardLogo.svelte';
	import { scriptLogo } from '#lib/core/data/script-logo.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { markBoardShown } from '#lib/ui/board-cover.ts';
	import { playerSettings } from './player-settings.svelte.ts';
	import {
		DEFAULT_SEAT_LAYOUT,
		parseAspect,
		parseSeatLayout,
		sharedSeats
	} from '#lib/ui/seating/seat-layout.ts';
	import {
		AVATAR_GUESS,
		GENERIC_GUESSES,
		clearGuesses,
		cycleGuess,
		genericGuess,
		guessesOf,
		mainGuess,
		readGuesses,
		seatCycle,
		toggleGuess,
		travellerGuess,
		travellerTeam,
		writeGuesses,
		type GenericGuess,
		type GuessMark,
		type Guesses
	} from './grim-guesses.ts';
	import GenericGuessToken from './GenericGuessToken.svelte';
	import GuessMarks from './GuessMarks.svelte';
	import AvatarFace from '#lib/ui/seating/AvatarFace.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import SeatNotesDialog from '#lib/ui/notes/SeatNotesDialog.svelte';
	import { deleteSeatNote, notesLine, saveSeatNote, seatNotes } from './seat-notes.svelte.ts';
	import AlignmentPill from '#lib/features/grimoire/AlignmentPill.svelte';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import { matchesShape } from './MatchShapeButton.svelte';
	import PlayerGrimTools from './PlayerGrimTools.svelte';
	import GenericGuessGrid from './GenericGuessGrid.svelte';
	import SeatPictureMenu from './SeatPictureMenu.svelte';
	import SeatAvatarButton from './SeatAvatarButton.svelte';
	import FullScreenStage from '#lib/ui/layout/FullScreenStage.svelte';
	import { fitInDialog } from '#lib/ui/fit-in-dialog.ts';

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
		/** The town from the Storyteller's board or Public Town; a phone reads its room. */
		town?: PlayerGrimTown;
		/** A Public Town display (Trevor, 2026-10-26): nothing to tap, nothing of this device's. */
		display?: boolean;
		/** Full screen in the town's top right corner: the player screen's Grim (PlayerScreen) and Public Town. */
		fullScreen?: boolean;
		/** More of that corner, before Full screen; told whether the town fills the screen. */
		corner?: Snippet<[boolean]>;
	}

	let { script, town, display = false, fullScreen = false, corner }: Props = $props();

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
	/** The reminder tokens this player put on seats (Trevor, 2026-10-26), kept as guesses are. */
	const reminders = new PlayerReminderState();
	let remindersOpen = $state(false);
	/** The reminder bin (Trevor, 2026-10-29), from the grim's controls. */
	let binOpen = $state(false);
	let bin = $state<ReturnType<typeof PlayerReminderBin>>();
	let seating = $state<ReturnType<typeof PlayerSeating>>(); // Seating on the grim (plan J38).
	let townEl = $state<HTMLElement>();
	let held = $state<string>(); // The seat a finger is on, its reminder lines under "While held".
	/** The seat the room gave this phone; it has a ring on the grim. */
	const mine = $derived(player?.view?.me.seatId);
	/** The player's own notes on each seat (Trevor, 2026-10-24), shared with the Notes tab. */
	// Set in an effect, not a derived, so the derived below follows the notes it reads.
	let book = $state<ReturnType<typeof seatNotes>>();
	$effect.pre(() => {
		guesses = kept ? readGuesses(kept) : {};
		reminders.load(kept);
		book = kept ? seatNotes(kept) : undefined;
	});
	/**
	 * The eye (Trevor, 2026-10-26: "Hide grim guesses, eyeball feature like we use in notes"):
	 * on, the town shows only what the table knows, with none of this player's guesses or notes.
	 */
	const hiding = $derived(playerSettings.current.hideGuesses);
	const notes = $derived(hiding ? {} : (book?.notes ?? {}));
	/** The player's own reminders, hidden by the eye with their guesses. */
	const visible = $derived(hiding ? {} : reminders.current);
	// Share, the QR code and every sheet blur the Grim behind them, as over the board
	// (Trevor, 2026-10-26: players at the table could read guesses behind Share).
	$effect(() => markBoardShown());
	let noteOpen = $state(false);

	/**
	 * The finished grimoire the Storyteller shared at game end (Share grim, R5), in place of
	 * the town until switched off (Trevor, 2026-10-24); its History steps through on this
	 * phone only.
	 */
	const final = $derived(finalGrimoireOf(town, player, code));
	let showFinal = $state(true);
	let arrivedAt = $state(0);
	$effect(() => {
		if (final) arrivedAt = Date.now();
	});
	const over = $derived<EndedGame | undefined>(
		final ? ({ endedAt: arrivedAt, ...final.ended } as EndedGame) : undefined
	);

	const nameOf = (seat: PublicSeat) =>
		seat.playerName ?? t('common.seat', { number: seat.seatNumber });
	function pictureOf(seat: PublicSeat): string | undefined {
		const hash = (town ? town.pictures : player?.view?.pictures)?.[seat.seatId];
		const room = town ? town.roomCode : code;
		if (hash && room) return roomImagePath(room, hash);
		return town && !town.roomCode && !display ? roomHost().pictureOf(seat.seatId) : undefined;
	}

	// The board's own layout, read like a saved one, so a bad one never stops the drawing.
	const layout = $derived(table?.layout ? parseSeatLayout(table.layout) : DEFAULT_SEAT_LAYOUT);
	let width = $state(0);
	let height = $state(0);
	const board = $derived({ width, height });
	// The Storyteller's places round the ring, in the board's shape if switched on (2026-10-27).
	const aspect = $derived(parseAspect(table?.layout?.aspect));
	const unit = 16;
	// The ring keeps clear of the top right's controls, as the board's of its timer row.
	let toolsW = $state(0);
	let toolsH = $state(0);
	const tools = $derived(display ? undefined : { w: toolsW + 12, h: toolsH + 12 });
	const { size, points } = $derived(
		sharedSeats(seats, layout, board, aspect, matchesShape(display), preferences.current, tools)
	);

	// The corner's script name keeps clear of every seat and name, as on the board.
	const root = watchRootFont();
	const rootFont = $derived(root.current);
	const names = $derived(
		nameBoxes({ names: seats.map(nameOf), seats: points, size, unit, rootFont, board })
	);
	const cornerBoxes = $derived(
		cornerObstacles(points, names, size, boardLooks.current.nameOffset, board)
	);
	const fitCorner = $derived(cornerFit(cornerBoxes, board));

	/** The characters this player guessed on any seat, and the Travellers the town knows. */
	const firstReminders = $derived([
		...new Set([
			...Object.values(guesses)
				.flat()
				.filter((id) => !genericGuess(id)),
			...seats.flatMap((seat) => seat.traveller ?? [])
		])
	]);

	// The Storyteller's background, vignette and logo, the same on every device whatever its own
	// settings or theme (Trevor, 2026-10-26); the script's own image only as a web link.
	/** The live room a seat's profile can add friends from (plan F2). */
	const friendRoom = $derived(display ? undefined : town ? town.roomCode : code);
	const look = $derived(drawnLook(parsePublicLook(table?.look)));
	// The room's picture (Trevor, 2026-10-26: "Images should be uploaded and shared"), or the
	// board's own one on the Storyteller's device.
	const pictureRoom = $derived(town ? (town.pictureRoom ?? town.roomCode) : code);
	let pictureUrl = $state<string>();
	$effect(() => {
		const picture = town?.picture;
		pictureUrl = picture && URL.createObjectURL(picture);
		return () => {
			if (picture) URL.revokeObjectURL(pictureUrl!);
		};
	});
	const scriptImage = $derived(
		/^https:\/\//.test(script.meta?.background ?? '') ? script.meta?.background : undefined
	);
	// The board's own colours in the town, not the player's sheet background.
	const boardColours = $derived(screenTheme.current ? themeColours(preferences.theme) : undefined);
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
		// A token tapped in the bin goes on the seat tapped next.
		if (bin?.placeOn(seat) || seating?.claim(seat)) return;
		// Hidden guesses never open in a sheet either.
		if (hiding) return;
		chosen = seat;
		// The note mark opens the note itself, as the board's does (Trevor, 2026-10-25), and
		// the guess pill makes the next guess the main one; its "+N" opens the sheet, where
		// every guess is listed (Trevor, 2026-10-29).
		const target = event?.target instanceof Element ? event.target : null;
		if (target?.closest('.mark.note')) noteOpen = true;
		else if (target?.closest('[data-testid="more-guesses"]')) open = true;
		else if (target?.closest('[data-testid="guess-marks"]'))
			save(cycleGuess(guesses, seat.seatId, withAvatar(seat)));
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
				: toggleGuess(guesses, chosen.seatId, characterId, withAvatar(chosen))
		);
	}
	/** Only Good or Evil for a Traveller's seat, whose character the town knows (Trevor, 2026-10-26). */
	const guessChoices = $derived(
		chosen?.traveller ? GENERIC_GUESSES.filter((g) => !g.type) : GENERIC_GUESSES
	);
	/**
	 * A seat's avatar joins its guesses' cycle (Trevor, 2026-10-26), except on a Traveller's
	 * seat, whose character the town knows.
	 */
	/** A seat further right than this (in %) has its guesses' pill on the left rim. */
	const PILL_FLIP_X = 65;
	const withAvatar = (seat: PublicSeat) => !!seat.avatar && !seat.traveller;
	/**
	 * The seat's cycle, front first, as the token, its pill and the sheet show it: its guesses
	 * and, once it has one, its avatar.
	 */
	const listed = (seatId: string) => {
		const seat = seats.find((s) => s.seatId === seatId);
		return (
			seat?.traveller
				? guessesOf(guesses, seatId).filter(
						(id) => genericGuess(id)?.type === undefined && !!genericGuess(id)
					)
				: seatCycle(guesses, seatId, !!seat && withAvatar(seat))
		).map((id) => {
			const generic = genericGuess(id);
			if (id === AVATAR_GUESS && seat?.avatar) {
				const [name, label, picture] = [nameOf(seat), t('player.grim.avatar'), pictureOf(seat)];
				return { id, avatar: seat.avatar, name, label, picture };
			}
			return generic
				? { id, generic, label: genericLabel(generic) }
				: { id, character: characterOf(id) };
		});
	};

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
		const guessed = hiding
			? []
			: listed(seat.seatId)
					.map((g) => guessName(g.id))
					.filter(Boolean);
		if (guessed.length) parts.push(t('player.grim.guess', { name: guessed.join(', ') }));
		const placed = remindersOn(visible, seat.seatId);
		if (placed.length)
			parts.push(t('player.grim.hasReminders', { labels: placed.map(reminderWords).join(', ') }));
		if (notes[seat.seatId]) parts.push(t('player.grim.hasNote'));
		return parts.join(', ');
	}
	/* eslint-enable grim/names-as-badges */
</script>

{#if final && showFinal}
	<!-- The finished grimoire brings its own toolbar; the switch puts the town back. -->
	<div class="tools">
		<Toggle
			label={t('room.finalGrimoire')}
			checked={showFinal}
			onChange={(on) => (showFinal = on)}
		/>
	</div>
	<div class="final" data-testid="final-grimoire">
		<SharedBoard shared={final.grimoire} {over} room={final.room} />
	</div>
{:else if !code || seats.length === 0}
	<p class="none" data-testid="grim-none">{t('common.none')}</p>
{:else}
	{#snippet townBoard()}
		<div
			class="town"
			class:display
			bind:clientWidth={width}
			bind:clientHeight={height}
			style:--name-scale={boardLooks.current.nameSize}
			style:--name-offset={boardLooks.current.nameOffset}
			style={boardColours}
			data-board-colours={boardColours ? '' : undefined}
			data-testid="player-grim"
			bind:this={townEl}
			{@attach fitInDialog}
		>
			<BoardBackdrop
				contained
				url={pictureUrl ??
					(look.image && pictureRoom
						? roomImagePath(pictureRoom, look.image)
						: look.script
							? scriptImage
							: undefined)}
				preset={look.preset}
				vignette={look.vignette}
			/>
			{#if look.logo !== undefined}
				<BoardLogo
					src={logo}
					name={script.meta?.hideTitle ? undefined : script.meta?.name}
					opacity={look.logo}
					onfail={() => (logoFailed = true)}
				/>
			{/if}
			{#each seats as seat, i (seat.seatId)}
				{@const point = points[i]}
				{@const known = characterOf(seat.traveller)}
				<!-- A Traveller's seat takes only an alignment, shown in its icon's colour. -->
				{@const team = known && !hiding ? travellerTeam(guesses, seat.seatId)?.team : undefined}
				{@const cycle = known || hiding ? [] : listed(seat.seatId)}
				<!-- The front of the cycle: a guess, or the player's avatar (plan R6) cycled to. -->
				{@const main = cycle[0]?.id}
				{@const guessed = genericGuess(main) ?? characterOf(main)}
				{@const others = cycle
					.slice(1)
					.flatMap((g): GuessMark[] =>
						g.avatar
							? [{ avatar: g.avatar, name: g.name, label: g.label, picture: g.picture }]
							: g.generic
								? [{ generic: g.generic, label: g.label }]
								: g.character
									? [{ character: g.character }]
									: []
					)}
				{@const shown = known ?? guessed}
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
					onpointerdown={() => (held = seat.seatId)}
				>
					<SeatDisc
						{size}
						dead={seat.dead}
						name={nameOf(seat)}
						number={seat.seatNumber}
						face={shown ? face : undefined}
						vote={seat.ghostVote}
						avatar={seat.avatar}
						picture={pictureOf(seat)}
						usedVote={boardLooks.current.usedGhostVote}
						frame={seatFrame(seat.frame)}
						marks={notes[seat.seatId] || others.length ? marks : undefined}
					/>
					{#snippet marks()}
						<!-- The board's own mark (SeatNoteMark): tapping it opens the note, as on the board. -->
						{#if notes[seat.seatId]}<SeatNoteMark />{/if}
						{#if others.length}<GuessMarks
								{others}
								side={(point?.x ?? 0) > PILL_FLIP_X ? 'left' : 'right'}
							/>{/if}
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
			<!-- The player's own reminders, in front of each seat as on the board; a tap opens the
			     seat's reminders. -->
			<PlayerSeatReminders
				{seats}
				{points}
				{board}
				{size}
				reminders={visible}
				{names}
				{notes}
				{characterOf}
				bind:held
				onOpen={(seat) => {
					chosen = seat;
					remindersOpen = true;
				}}
			/>
			{#if !display}<PlayerReminderBin
					bind:this={bin}
					bind:open={binOpen}
					characters={script.characters}
					guessed={firstReminders}
					{seats}
					{points}
					town={townEl}
					{size}
					chip={reminderChip(size, preferences.current.tokenAppearance.reminderScale)}
					onPlace={(seat, r) => reminders.place(seat.seatId, r)}
				/>{/if}
			{#if player}<PlayerSeating
					bind:this={seating}
					{player}
					ring={{ seats, points, size }}
					{board}
					town={townEl}
					{nameOf}
					shape={{ aspect, fit: matchesShape(display) }}
					onTap={(seat) => choose(seat)}
				/>{/if}
			<!-- The Grim tab's controls, top right; with Full screen, in its corner. A Public
			     Town display shows only public things. -->
			{#if !display && !fullScreen}{@render grimTools(true)}{/if}
			<!-- The board's corner, line for line as the Storyteller's board shows it (Trevor,
			     2026-10-24); its name opens Game info (Trevor, 2026-10-30), nothing to share. -->
			<BoardCorner
				meta={script.meta}
				storytellerName={table?.storytellerName}
				corner={table?.corner}
				roomCode={town ? (town.roomCode ?? roomHost().code) : code}
				logo={logo && !logoFailed ? logo : undefined}
				watching
				townInfo={display ? undefined : { roomCode: friendRoom, storyteller: table?.storyteller }}
				fitRoom={fitCorner}
				{width}
				{rootFont}
			/>
		</div>
	{/snippet}
	<!-- Full screen in the town's top right corner (Trevor, 2026-10-27: players too, "same thing
	     as town square"), the Storyteller's player view too (Trevor, 2026-10-28). -->
	{#if fullScreen}<FullScreenStage
			corner={stageCorner}
			bind:cornerWidth={toolsW}
			bind:cornerHeight={toolsH}>{@render townBoard()}</FullScreenStage
		>{:else}{@render townBoard()}{/if}
{/if}

{#snippet grimTools(placed: boolean)}<PlayerGrimTools
		{placed}
		bind:width={toolsW}
		bind:height={toolsH}
		shaped={!!aspect}
		final={!!final}
		{showFinal}
		onFinal={(on) => (showFinal = on)}
		bin={{ open: binOpen, disabled: hiding, onToggle: () => (binOpen = !binOpen) }}
		info={{ meta: script.meta, table, roomCode: friendRoom }}
	/>{/snippet}
<!-- Full screen's corner: this grim's controls, the page's own, then Full screen. -->
{#snippet stageCorner(filled: boolean)}
	{#if !display}{@render grimTools(false)}{/if}
	{@render corner?.(filled)}
{/snippet}

{#snippet pictureMenu()}<SeatPictureMenu room={player!} seat={chosen!} />{/snippet}
<!-- The player's avatar, left of the seat's name and guesses (Trevor, 2026-10-27); a tap
     opens their profile (2026-10-28). -->
{#snippet seatAvatar()}<SeatAvatarButton
		avatar={chosen!.avatar!}
		name={nameOf(chosen!)}
		picture={pictureOf(chosen!)}
		frame={chosen!.frame}
		friend={friendRoom ? { code: friendRoom, seatId: chosen!.seatId } : undefined}
	/>{/snippet}
<BottomSheet
	bind:open
	title={chosen ? `${t('common.seat', { number: chosen.seatNumber })} · ${nameOf(chosen)}` : ''}
	actions={player && chosen ? pictureMenu : undefined}
	lead={chosen?.avatar ? seatAvatar : undefined}
>
	<!-- This seat's cycle, front first, at the top (Trevor, 2026-10-25): its guesses and, once
	     it has one, the player's avatar (2026-10-26); a tap brings one to the front. Then the
	     note, a row of its own, so the two never read as one. -->
	<div class="row" data-testid="seat-guesses">
		<span class="row-label">{t('player.grim.guesses')}</span>
		<ul class="chips" aria-label={t('player.grim.guesses')}>
			{#each chosen ? listed(chosen.seatId) : [] as g, i (g.id)}
				<li>
					<button
						type="button"
						class="chip"
						aria-pressed={i === 0}
						aria-label={g.avatar ? g.label : undefined}
						onclick={() =>
							chosen && save(mainGuess(guesses, chosen.seatId, g.id, withAvatar(chosen)))}
						>{#if g.avatar}<span class="avatar-chip"
								><AvatarFace avatar={g.avatar} name={g.name} picture={g.picture} /></span
							>{:else if g.generic}<AlignmentPill
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
	<!-- The player's tokens on the seat (Trevor, 2026-10-26, as tokens 2026-10-30); a tap opens them. -->
	<button
		type="button"
		class="row seat-note"
		data-testid="seat-reminders"
		onclick={() => (remindersOpen = true)}
		><span class="row-label">{t('player.grim.reminders')}</span><ReminderTokenRow inline oneLine
			>{#each chosen ? remindersOn(reminders.current, chosen.seatId) : [] as reminder, i (i)}<BoardReminder
					{...playerLook(reminder, characterOf)}
				/>{:else}<span class="row-none">{t('common.none')}</span>{/each}</ReminderTokenRow
		></button
	>
	<!-- The player's own notes on this seat (Trevor, 2026-10-24; several since 2026-10-26). -->
	<button
		type="button"
		class="row seat-note"
		data-testid="seat-note"
		onclick={() => (noteOpen = true)}
		><span class="row-label">{t('player.notes')}</span><span class="seat-note-text"
			>{(chosen && notesLine(notes[chosen.seatId], t('player.hidden'))) || t('common.none')}</span
		></button
	>
	<!-- A seat by its type alone, or only good or evil (Trevor, 2026-10-24), above the
	     characters; a Traveller's seat has only Good and Evil, and no characters. -->
	<GenericGuessGrid
		choices={guessChoices}
		label={genericLabel}
		pressed={(key) => !!chosen && guessesOf(guesses, chosen.seatId).includes(key)}
		onGuess={guess}
	/>
	{#if !chosen?.traveller}<CharacterPicker
			characters={script.characters}
			selected={chosen ? guessesOf(guesses, chosen.seatId) : []}
			onSelect={(id) => guess(id)}
			onNone={() => chosen && save(clearGuesses(guesses, chosen.seatId))}
		/>{/if}
</BottomSheet>

<PlayerReminderPicker
	bind:open={remindersOpen}
	name={chosen ? nameOf(chosen) : ''}
	placed={chosen ? remindersOn(reminders.current, chosen.seatId) : []}
	characterOf={(id) => characterOf(id)}
	onToggle={(r) => chosen && reminders.toggle(chosen.seatId, r)}
	onGenericLook={(id, look) => chosen && reminders.setLook(chosen.seatId, id, look)}
/>

<SeatNotesDialog
	bind:open={noteOpen}
	title={chosen ? t('player.grim.notesTitle', { name: nameOf(chosen) }) : ''}
	notes={(chosen && notes[chosen.seatId]) || []}
	onSave={(note) => kept && chosen && saveSeatNote(kept, chosen.seatId, note)}
	onDelete={(noteId) => kept && chosen && deleteSeatNote(kept, chosen.seatId, noteId)}
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
	/* The seat's avatar in its cycle, the size of a badge's icon. */
	.avatar-chip {
		display: block;
		width: 2em;
		height: 2em;
	}
	.seat-note-text {
		overflow: hidden;
		color: var(--on-surface-muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	/* Over the finished grimoire: its switch alone, at the end. */
	.tools {
		display: flex;
		justify-content: flex-end;
		margin-bottom: var(--space-2);
	}
	/* The Storyteller's board, as tall as it draws itself (a screen high, with History's
	   Previous and Next inside its foot), so the tabs' bottom bar never covers them. */
	.final {
		position: relative;
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
		/* In a dialog (the Storyteller's player view), no taller than the room left under the
		   tabs, so the whole ring shows on a wide, short window (fitInDialog); never so short
		   that the seats crowd together. */
		height: max(40dvh, min(75dvh, var(--fit-height, 75dvh)));
	}
	/* On a themed screen the town keeps the board's own surface, as on the Storyteller's. */
	.town[data-board-colours] {
		background: var(--page-background);
		color: var(--on-surface);
	}
	.display .seat {
		cursor: default;
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
	/* Your own seat has a ring (Trevor, 2026-10-26: "special glow or effect on self in grim"),
	   steady, with no pulse (2026-10-27: "having ring is good enough"). In the text colour, not
	   the accent, since red or blue would read as an alignment (the accent is red in some themes). */
	.seat[data-mine] :global(.disc) {
		outline: calc(0.2 * var(--u)) solid var(--on-surface);
		outline-offset: calc(0.2 * var(--u));
		border-radius: 50%;
	}
	/* A guess is the player's own, so it never looks like something the town was told. Only
	   the seat's round face: a token's own SVG circle is a .face too, and an outline there
	   drew dashed square edges round the token (2026-10-28). */
	.seat[data-guess] :global(.disc > .face) {
		opacity: 0.75;
		outline: calc(0.15 * var(--u)) dashed var(--on-surface-muted);
		outline-offset: calc(0.1 * var(--u));
	}
</style>

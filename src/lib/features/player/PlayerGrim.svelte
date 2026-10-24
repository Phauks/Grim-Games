<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { CharacterId, LoadedScript } from '#lib/core/data/index.ts';
	import type { PublicCorner, PublicSeat } from '#lib/core/sync/public-projection.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { lastRoom } from '#lib/features/room/player.svelte.ts';
	import { releaseRoom, useRoom } from '#lib/features/room/room-connection.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { finalGrimoire } from '#lib/features/room/final-grimoire.svelte.ts';
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
	import { readGuesses, withGuess, writeGuesses, type Guesses } from './grim-guesses.ts';

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
			gameId: string;
			guessKey: string;
		};
	}

	let { script, town }: Props = $props();

	// svelte-ignore state_referenced_locally
	const code = town ? town.guessKey : lastRoom();
	// svelte-ignore state_referenced_locally
	const player = !town && code ? useRoom(code) : undefined;
	$effect(() => () => {
		if (player) releaseRoom(player);
	});

	const table = $derived(town ?? player?.view?.public);
	const seats = $derived(table?.seats ?? []);
	const mine = $derived(player?.view?.me.seatId);
	let guesses = $state<Guesses>(code ? readGuesses(code) : {});

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
	function choose(seat: PublicSeat) {
		chosen = seat;
		open = true;
	}
	function guess(characterId?: CharacterId) {
		if (!code || !chosen) return;
		guesses = withGuess(guesses, chosen.seatId, characterId);
		writeGuesses(code, guesses);
		open = false;
	}

	/* eslint-disable grim/names-as-badges -- the seat button's accessible name (aria-label) only */
	function label(seat: PublicSeat): string {
		const parts = [`${t('common.seat', { number: seat.seatNumber })}: ${nameOf(seat)}`];
		if (seat.seatId === mine) parts.push(t('player.grim.you'));
		if (seat.dead) parts.push(t('player.grim.dead'));
		if (seat.ghostVote === 'unused') parts.push(t('player.grim.voteUnused'));
		if (seat.ghostVote === 'used') parts.push(t('player.grim.voteUsed'));
		const traveller = characterOf(seat.traveller);
		if (traveller) parts.push(t('player.grim.traveller', { name: traveller.name }));
		const guessed = characterOf(guesses[seat.seatId]);
		if (guessed) parts.push(t('player.grim.guess', { name: guessed.name }));
		return parts.join(', ');
	}
	/* eslint-enable grim/names-as-badges */
</script>

<!-- Share grim (plan R5): in its place all game, usable once the Storyteller shares it; the
     board's own copy of this tab has no such button. -->
{#if !town}
	<div class="tools">
		<Button icon="grimoire" disabled={!player?.revealed} onclick={() => (finalGrimoire.open = true)}
			>{t('room.finalGrimoire')}</Button
		>
	</div>
{/if}
{#if !code || seats.length === 0}
	<p class="none" data-testid="grim-none">{t('common.none')}</p>
{:else}
	<div
		class="town"
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
			{@const guessed = characterOf(guesses[seat.seatId])}
			<!-- The player's avatar unless their own guess is set to show over it (plan R6). -->
			{@const shown =
				known ?? (seat.avatar && !playerSettings.current.guessesOnTokens ? undefined : guessed)}
			<button
				type="button"
				class="seat"
				data-mine={seat.seatId === mine || undefined}
				data-guess={(!known && !!guessed && shown === guessed) || undefined}
				style:left="{point?.x ?? 50}%"
				style:top="{point?.y ?? 50}%"
				aria-label={label(seat)}
				data-testid="grim-seat"
				onclick={() => choose(seat)}
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
				/>
				{#snippet face()}
					{#if shown}<CharacterToken character={shown} {size} />{/if}
				{/snippet}
			</button>
		{/each}
		<!-- The board's corner, line for line as the Storyteller's board shows it (Trevor,
		     2026-10-24); nothing to open or share here. -->
		<BoardCorner
			meta={script.meta}
			storytellerName={table?.storytellerName}
			corner={table?.corner}
			roomCode={town ? roomHost().code : code}
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
	<!-- Also in Settings > Player: one switch for every seat. -->
	<SettingToggle
		label={t('player.guessesOnTokens')}
		checked={playerSettings.current.guessesOnTokens}
		onChange={(guessesOnTokens) => playerSettings.update({ guessesOnTokens })}
	/>
	<CharacterPicker
		characters={script.characters}
		selected={chosen && guesses[chosen.seatId] ? [guesses[chosen.seatId]] : []}
		onSelect={(id) => guess(id)}
		onNone={() => guess()}
	/>
</BottomSheet>

<style>
	.tools {
		display: flex;
		justify-content: flex-end;
		margin-bottom: var(--space-2);
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
	.seat[data-mine] :global(.disc) {
		outline: calc(0.2 * var(--u)) solid var(--accent);
		outline-offset: calc(0.2 * var(--u));
		border-radius: 50%;
	}
	/* A guess is the player's own, so it never looks like something the town was told. */
	.seat[data-guess] :global(.face) {
		opacity: 0.75;
		outline: calc(0.15 * var(--u)) dashed var(--on-surface-muted);
		outline-offset: calc(0.1 * var(--u));
	}
</style>

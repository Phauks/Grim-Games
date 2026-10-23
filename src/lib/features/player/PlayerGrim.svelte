<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { CharacterId, LoadedScript } from '#lib/core/data/index.ts';
	import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { lastRoom } from '#lib/features/room/player.svelte.ts';
	import { releaseRoom, useRoom } from '#lib/features/room/room-connection.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import SeatDisc from '#lib/ui/seating/SeatDisc.svelte';
	import { seatFrame } from '#lib/core/frames/index.ts';
	import { boardLooks } from '#lib/features/grimoire/board-looks.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { playerSettings } from './player-settings.svelte.ts';
	import {
		DEFAULT_SEAT_LAYOUT,
		keepInside,
		seatPoints,
		seatTokenSize,
		withShape
	} from '#lib/ui/seating/seat-layout.ts';
	import { readGuesses, withGuess, writeGuesses, type Guesses } from './grim-guesses.ts';

	/**
	 * /play's Grim tab (Trevor, 2026-10-19): the town as everyone at the table knows it, from
	 * the live room this phone joined. Who is alive or dead, who has spent their ghost vote,
	 * and the Travellers the town was told about; nothing else, so it never says more than the
	 * table does. A tap puts the player's own guess of a seat's character on it, kept on this
	 * phone only.
	 */
	interface Props {
		script: LoadedScript;
	}

	let { script }: Props = $props();

	const code = lastRoom();
	const player = code ? useRoom(code) : undefined;
	$effect(() => () => {
		if (player) releaseRoom(player);
	});

	const seats = $derived(player?.view?.public?.seats ?? []);
	const mine = $derived(player?.view?.me.seatId);
	let guesses = $state<Guesses>(code ? readGuesses(code) : {});

	const layout = withShape(DEFAULT_SEAT_LAYOUT, 'circle');
	let width = $state(0);
	let height = $state(0);
	const ids = $derived(seats.map((s) => s.seatId as string));
	const size = $derived(seatTokenSize(ids, layout, { width, height }));
	const points = $derived(
		keepInside(seatPoints(ids, layout, { width, height }), { width, height }, size / 2)
	);

	const characterOf = (id: CharacterId | undefined) =>
		id === undefined
			? undefined
			: (script.characters.find((c) => c.id === id) ??
				officialData.current?.characters.find((c) => c.id === id));

	const nameOf = (seat: PublicSeat) =>
		seat.playerName ?? t('common.seat', { number: seat.seatNumber });

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

{#if !code || seats.length === 0}
	<p class="none" data-testid="grim-none">{t('common.none')}</p>
{:else}
	<div class="town" bind:clientWidth={width} bind:clientHeight={height} data-testid="player-grim">
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
					frame={seatFrame(seat.frame, boardLooks.current.defaultFrame)}
				/>
				{#snippet face()}
					{#if shown}<CharacterToken character={shown} {size} />{/if}
				{/snippet}
			</button>
		{/each}
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
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	/* A square town on a phone, as tall as the screen allows on a wide window. */
	.town {
		position: relative;
		width: 100%;
		max-width: 80dvh;
		aspect-ratio: 1;
		margin-inline: auto;
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

<script lang="ts">
	import { defaultAlignment, type Character } from '#lib/core/data/index.ts';
	import type { Seat } from '#lib/core/model/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SeatDisc from '#lib/ui/seating/SeatDisc.svelte';
	import type { NamePlace } from './name-placement.ts';

	interface Props {
		seat: Seat;
		/** 1-based place in the seating order. */
		number: number;
		character?: Character;
		/** Token size in px. */
		size: number;
		/** The character is not on the script. */
		orphan: boolean;
		/** Highlighted while a reminder is dragged over it. */
		dropTarget?: boolean;
		/** Marked as a seat a setup reminder fits, while one is dragged or open. */
		hint?: boolean;
		/** Faded while a reminder that doesn't fit this seat is dragged (it can still go here). */
		misfit?: boolean;
		/** Which side of the token the name goes, so nothing covers it. */
		namePlace?: NamePlace;
		onTap: () => void;
	}

	let {
		seat,
		number,
		character,
		size,
		orphan,
		dropTarget = false,
		hint = false,
		misfit = false,
		namePlace = 'below',
		onTap
	}: Props = $props();

	// As in the physical grimoire, a token is upside down when the player's alignment is not
	// the one their character type starts with (a good Minion, an evil Townsfolk).
	const startsAs = $derived(character ? defaultAlignment(character.type) : undefined);
	const shifted = $derived(
		startsAs !== undefined && seat.alignment !== undefined && seat.alignment !== startsAs
	);

	const name = $derived(seat.playerName ?? `Seat ${number}`);
	const label = $derived(
		[
			`Seat ${number}: ${seat.playerName ?? 'no name'}`,
			character?.name ?? 'no character',
			seat.dead ? 'dead' : '',
			// A Traveller has no starting alignment: always say it, or that it is not set yet.
			character?.type === 'traveller'
				? (seat.alignment ?? 'alignment not set')
				: shifted
					? `${seat.alignment}`
					: '',
			orphan ? 'not on the script' : '',
			seat.note ? 'has a note' : '',
			seat.reminders.length
				? `${seat.reminders.length} reminder${seat.reminders.length === 1 ? '' : 's'}`
				: ''
		]
			.filter(Boolean)
			.join(', ')
	);

	// Taps come from Pointer Events, not `click`: browsers drop the click of a tap that lands
	// just after a swipe (the seat-sheet spike). `click` with detail 0 still covers keyboards.
	let down: { x: number; y: number } | null = null;
	const TAP_SLOP = 10;

	function pointerup(event: PointerEvent) {
		if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) < TAP_SLOP) onTap();
		down = null;
	}
</script>

{#snippet face()}
	{#if character}
		<CharacterToken
			{character}
			alignment={seat.alignment}
			{size}
			showName={preferences.current.tokenAppearance.boardNames}
		/>
	{/if}
{/snippet}

{#snippet marks()}
	<!-- Corner marks sit in fixed places, so one appearing never moves anything. -->
	{#if orphan}<span class="mark orphan" title="Not on the script"><Icon name="warning" /></span
		>{/if}
	<!-- The Storyteller's note on this player, lower right (never shown to players). -->
	{#if seat.note}<span class="mark note" data-testid="note-mark" title="Note"
			><Icon name="pen" /></span
		>{/if}
	<!-- A dead player's ghost vote, upper left, until it is used. -->
	{#if seat.dead && !seat.ghostVoteUsed}<span
			class="vote"
			data-testid="ghost-vote"
			title="Ghost vote"><Icon name="ghostVote" /></span
		>{/if}
{/snippet}

<button
	type="button"
	class="seat"
	data-dead={seat.dead || undefined}
	data-drop={dropTarget || undefined}
	data-hint={hint || undefined}
	data-misfit={misfit || undefined}
	data-testid="seat"
	aria-label={label}
	style:--size="{size}px"
	style:--token-scale="1"
	onpointerdown={(event) => (down = { x: event.clientX, y: event.clientY })}
	onpointerup={pointerup}
	onpointercancel={() => (down = null)}
	onclick={(event) => event.detail === 0 && onTap()}
>
	<SeatDisc
		{size}
		dead={seat.dead}
		flipped={shifted}
		{name}
		{number}
		{namePlace}
		face={character ? face : undefined}
		{marks}
	/>
</button>

<style>
	.seat[data-hint] :global(.disc) {
		outline: 2px dashed var(--focus);
		outline-offset: 4px;
		border-radius: 50%;
	}
	.seat[data-misfit] :global(.disc) {
		opacity: 0.4;
	}
	.seat[data-drop] :global(.disc) {
		outline: 3px solid var(--focus);
		outline-offset: 4px;
		border-radius: 50%;
	}
	.seat {
		position: relative;
		display: grid;
		justify-items: center;
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface);
		cursor: pointer;
		touch-action: manipulation;
	}
	.mark {
		position: absolute;
		display: grid;
		place-items: center;
		width: max(1.125 * var(--u), calc(var(--size) * 0.3));
		height: max(1.125 * var(--u), calc(var(--size) * 0.3));
		border-radius: 50%;
		box-shadow: var(--shadow);
		--icon-size: calc(max(1.125 * var(--u), calc(var(--size) * 0.3)) * 0.65);
	}
	.vote {
		position: absolute;
		top: -6%;
		left: -6%;
		display: grid;
		place-items: center;
		width: calc(1.25 * var(--u));
		height: calc(1.25 * var(--u));
		border-radius: 50%;
		background: var(--surface-raised);
		color: var(--on-surface);
		box-shadow: var(--shadow);
		--icon-size: calc(0.875 * var(--u));
	}
	/* Upper right, so the ghost vote keeps the upper left. */
	.orphan {
		right: -4%;
		top: -4%;
		background: var(--accent);
		color: var(--on-accent);
	}
	/* Lower right: the dead skull keeps the lower left. */
	.note {
		right: -4%;
		bottom: -4%;
		background: var(--surface-raised);
		color: var(--on-surface);
	}
</style>

<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import {
		looseReminders,
		type ReminderId,
		type ReminderInstance,
		type SeatId
	} from '#lib/core/model/index.ts';
	import { heldAbilitiesOf, votesWithoutToken } from '#lib/core/rules/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { SeatPoint } from '#lib/ui/seating/seat-layout.ts';
	import BoardReminderChip from './BoardReminderChip.svelte';
	import { isOrphan, placingAlignment } from './board.ts';
	import ReminderTethers from './ReminderTethers.svelte';
	import { boardLooks } from './board-looks.svelte.ts';
	import type { Grimoire } from './grimoire.svelte.ts';
	import type { NightWalk } from './night-walk.svelte.ts';
	import type { ReminderDragging } from './reminder-drag.svelte.ts';
	import type { SeatArranging } from './seat-arranging.svelte.ts';
	import type { SeatHints } from './seat-hints.svelte.ts';
	import SeatToken from './SeatToken.svelte';
	import { remindersBeside, trueCharacterMarks } from './true-character-marks.ts';

	type SeatPart = 'note' | 'nominate' | 'avatar';

	/**
	 * The ring on the board: each seat's token, its reminders with their tethers, the reminders
	 * that belong to no one, and the spots where a new seat can go. Where each sits is worked out
	 * by the board; this draws them and hands taps and drags back.
	 */
	interface Props {
		grimoire: Grimoire;
		/** Each seat's place, in seating order (percent of the board). */
		shown: readonly SeatPoint[];
		/** Each seat's reminders' places, in seating order. */
		fan: readonly SeatPoint[][];
		size: number;
		chip: number;
		boardSize: { width: number; height: number };
		seatArr: SeatArranging;
		remDrag: ReminderDragging;
		hints: SeatHints;
		nw: NightWalk;
		watching: boolean;
		/** Characters this game allows off the script. */
		offScriptOk: ReadonlySet<CharacterId>;
		nightNumbers?: { first: Map<CharacterId, number>; other: Map<CharacterId, number> };
		nominations: (seatId: SeatId) => { made?: boolean; received: boolean } | undefined;
		heldSeat: SeatId | undefined;
		/** A Fabled or Loric's reminder, while it is dragged. */
		heldDrag: ReminderInstance | undefined;
		placeSpots: readonly { position: number; at: SeatPoint; label: string }[];
		onPlace: (position: number) => void;
		onSeat: (seatId: SeatId, part?: SeatPart) => void;
		onReminder: (seatId: SeatId, reminderId: ReminderId) => void;
		onLooseReminder: (reminderId: ReminderId) => void;
	}

	let {
		grimoire,
		shown,
		fan,
		size,
		chip,
		boardSize,
		seatArr,
		remDrag,
		hints,
		nw,
		watching,
		offScriptOk,
		nightNumbers,
		nominations,
		heldSeat,
		heldDrag,
		placeSpots,
		onPlace,
		onSeat,
		onReminder,
		onLooseReminder
	}: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const seats = $derived(game.seating.map((id) => game.seats[id]));
	const looseMode = $derived(boardLooks.current.reminders === 'free');
	/** The character whose art a generic copy shows (Trevor, 2026-10-27), if any. */
	const artOf = (reminder: ReminderInstance) =>
		reminder.like ? characters.get(reminder.like.characterId) : undefined;
	/**
	 * The abilities each seat holds without their tokens (the Boffin's good character), in
	 * seating order: in the seat's bottom-right pill, or Vanilla, beside the seat as the wiki
	 * runs it (Board looks).
	 */
	const vanilla = $derived(boardLooks.current.abilityLook === 'vanilla');
	const held = $derived(
		seats.map((seat) =>
			heldAbilitiesOf(game, seat.seatId, characters).flatMap(({ characterId, works }) => {
				const as = characters.get(characterId);
				return as ? [{ character: as, works }] : [];
			})
		)
	);
	/**
	 * Grimbinder: each seat's "Is The …" reminders as small tokens marked = in its pill (Trevor,
	 * 2026-10-31, small token Option A); the rest of its reminders stay beside it. Vanilla: all
	 * beside it.
	 */
	const truthsInPill = $derived(boardLooks.current.truthLook === 'grimbinder');
	const beside = $derived(seats.map((seat) => remindersBeside(seat, characters, truthsInPill)));
	const truths = $derived(
		seats.map((seat) => (truthsInPill ? trueCharacterMarks(seat, characters) : []))
	);
</script>

<!-- Each seat's line to its reminders, by the Storyteller's "Reminder lines" choice (Trevor,
     2026-10-29); none for loose reminders, or while one is dragged. -->
{#if !looseMode && remDrag.drag === undefined}<ReminderTethers
		seats={seats.map((seat, i) => ({
			at: shown[i],
			spots: fan[i] ?? [],
			held: heldSeat === seat.seatId
		}))}
		board={boardSize}
		{size}
		{chip}
		mode={boardLooks.current.reminderLines}
	/>{/if}

{#each seats as seat, i (seat.seatId)}
	{@const at = shown[i]}
	<div
		class="slot"
		class:dragging={seatArr.drag?.seatId === seat.seatId}
		class:front={seatArr.front === seat.seatId}
		style:left="{at.x}%"
		style:top="{at.y}%"
		onpointerdown={(event) => seatArr.dragStart(event, seat.seatId, at)}
		onpointermove={(event) => seatArr.dragMove(event)}
		onpointerup={(event) => seatArr.dragEnd(event)}
		onpointercancel={() => seatArr.dragCancel()}
		onkeydown={(event) => seatArr.nudge(event, seat.seatId, at)}
		role="presentation"
	>
		<SeatToken
			{seat}
			number={i + 1}
			character={seat.characterId ? characters.get(seat.characterId) : undefined}
			{size}
			nightNumbers={nightNumbers && seat.characterId
				? {
						first: nightNumbers.first.get(seat.characterId),
						other: nightNumbers.other.get(seat.characterId)
					}
				: undefined}
			orphan={isOrphan(seat, game.script, characters, offScriptOk)}
			nominations={nominations(seat.seatId)}
			tokenFreeVotes={votesWithoutToken(game, seat.seatId, characters)}
			heldAbilities={vanilla ? [] : held[i]}
			trueCharacters={truths[i]}
			onReminder={(reminderId) =>
				!seatArr.arranging && !watching && onReminder(seat.seatId, reminderId)}
			dropTarget={seatArr.reorderTarget === seat.seatId ||
				(remDrag.drag !== undefined &&
					remDrag.drag.target === seat.seatId &&
					remDrag.drag.from !== seat.seatId) ||
				hints.tray.target === seat.seatId}
			dragFrom={remDrag.drag !== undefined && remDrag.drag.from === seat.seatId}
			misfit={hints.misfits.has(seat.seatId)}
			role={hints.role(seat.seatId)}
			onTap={(part) => !seatArr.arranging && onSeat(seat.seatId, part)}
			onHold={seatArr.arranging || watching ? undefined : (on) => on && seatArr.held(seat.seatId)}
			onGhostVote={() =>
				!seatArr.arranging &&
				!watching &&
				grimoire.run({
					type: seat.ghostVoteUsed ? 'RestoreGhostVote' : 'SpendGhostVote',
					seatId: seat.seatId
				})}
		/>
	</div>
{/each}

{#each seats as seat, i (seat.seatId)}
	{#if beside[i].length > 0}
		{@const at = fan[i]}
		{#each beside[i] as reminder, k (reminder.reminderId)}
			{@const dragged = remDrag.drag?.reminderId === reminder.reminderId}
			{@const spot = looseMode ? grimoire.reminderSpots[reminder.reminderId] : undefined}
			<BoardReminderChip
				{reminder}
				at={dragged ? remDrag.drag!.at : (spot ?? at[k])}
				character={characters.get(reminder.characterId)}
				alignment={placingAlignment(game, reminder, characters)}
				art={artOf(reminder)}
				size={chip}
				disabled={seatArr.arranging || watching}
				seatNumber={i + 1}
				onHeldSeat={heldSeat === seat.seatId}
				dragging={dragged}
				extra={hints.extras.has(reminder.reminderId)}
				now={nw.isStepReminder(reminder)}
				onTap={() => onReminder(seat.seatId, reminder.reminderId)}
				onDrag={(x, y, end) => remDrag.move(reminder.reminderId, seat.seatId, x, y, end)}
				onCancel={() => remDrag.cancel()}
			/>
		{/each}
	{/if}
{/each}

<!-- Vanilla: each held ability's token beside its seat, after the seat's reminders (the
     board's fan leaves it a place). Tapping it opens the seat, where the ability is changed. -->
{#if vanilla}
	{#each seats as seat, i (seat.seatId)}
		{#each held[i] as { character: as, works }, j (as.id)}
			{@const spot = fan[i]?.[beside[i].length + j] ?? shown[i]}
			<button
				type="button"
				class="held-token"
				data-testid="held-token"
				data-seat={i + 1}
				data-off={works ? undefined : ''}
				style:left="{spot.x}%"
				style:top="{spot.y}%"
				title={works ? `Holds the ${as.name} ability` : `Holds the ${as.name} ability (not now)`}
				disabled={seatArr.arranging || watching}
				onclick={() => onSeat(seat.seatId)}><CharacterToken character={as} size={chip} /></button
			>
		{/each}
	{/each}
{/if}

<!-- Reminders that belong to no one, where they were put down (Trevor, 2026-10-17). -->
{#each looseReminders(game) as reminder, k (reminder.reminderId)}
	{@const dragged = remDrag.drag?.reminderId === reminder.reminderId}
	<BoardReminderChip
		{reminder}
		at={dragged
			? remDrag.drag!.at
			: (grimoire.reminderSpots[reminder.reminderId] ?? { x: 12 + 8 * (k % 4), y: 80 })}
		character={characters.get(reminder.characterId)}
		alignment={placingAlignment(game, reminder, characters)}
		art={artOf(reminder)}
		size={chip}
		disabled={seatArr.arranging || watching}
		loose
		dragging={dragged}
		extra={hints.extras.has(reminder.reminderId)}
		unassigned={!looseMode}
		now={nw.isStepReminder(reminder)}
		onTap={() => onLooseReminder(reminder.reminderId)}
		onDrag={(x, y, end) => remDrag.move(reminder.reminderId, undefined, x, y, end)}
		onCancel={() => remDrag.cancel()}
	/>
{/each}
<!-- A Fabled or Loric's reminder follows the finger while it is dragged. -->
{#if heldDrag}
	<BoardReminderChip
		reminder={heldDrag}
		at={remDrag.drag!.at}
		character={characters.get(heldDrag.characterId)}
		art={artOf(heldDrag)}
		size={chip}
		disabled
		dragging
		ghost
		onTap={() => {}}
	/>
{/if}

{#each placeSpots as spot (spot.position)}
	<button
		type="button"
		class="place-spot"
		style:left="{spot.at.x}%"
		style:top="{spot.at.y}%"
		aria-label={spot.label}
		onclick={() => onPlace(spot.position)}><Icon name="add" /></button
	>
{/each}

<style>
	.slot {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 0;
		height: 0;
	}
	:global(.arranging) .slot {
		cursor: grab;
	}
	/* Above the other seats, still under the reminders (later in the page). */
	.slot.front {
		z-index: 1;
	}
	.slot.dragging {
		z-index: 2;
		cursor: grabbing;
	}
	/* A held seat lifts and everything else on the board darkens (Trevor, 2026-10-26). */
	:global(.holding) .slot.dragging {
		scale: 1.12;
	}
	:global(.holding) .slot:not(.dragging),
	:global(.holding .tethers line:not(.held)) {
		opacity: 0.35;
		transition: opacity 0.15s;
	}
	.held-token {
		position: absolute;
		z-index: 1;
		display: grid;
		place-items: center;
		min-width: var(--tap-target);
		min-height: var(--tap-target);
		padding: 0;
		translate: -50% -50%;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}
	/* Not now: faded and struck through, as in the pill, so it never rests on colour alone. */
	.held-token[data-off] > :global(*) {
		opacity: 0.4;
	}
	.held-token[data-off]::before {
		content: '';
		position: absolute;
		z-index: 1;
		width: 90%;
		height: calc(0.15 * var(--u));
		background: var(--on-surface);
		rotate: -45deg;
	}
	:global(.holding) .held-token {
		opacity: 0.35;
	}
	.place-spot {
		position: absolute;
		z-index: 3;
		display: grid;
		place-items: center;
		width: var(--tap-target);
		height: var(--tap-target);
		translate: -50% -50%;
		border: 2px dashed var(--accent);
		border-radius: 50%;
		background: var(--surface-raised);
		color: var(--accent);
		cursor: pointer;
	}
	.place-spot:hover {
		background: var(--surface-selected);
	}
</style>

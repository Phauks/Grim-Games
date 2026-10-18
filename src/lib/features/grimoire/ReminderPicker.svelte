<script lang="ts">
	import type { Reminder, ReminderId, SeatId } from '#lib/core/model/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatMisses } from './board.ts';
	import {
		canAddCopy,
		reminderCopies,
		reminderCopiesLeft,
		reminderGroups,
		reminderKey
	} from './reminders.ts';

	interface Props {
		open: boolean;
		grimoire: Grimoire;
		seatId: SeatId | undefined;
		/** The seat's name, for the title. */
		title: string;
		/** Takes a reminder off this seat (asking first when it normally stays put). */
		onRemove: (reminderId: ReminderId) => void;
		/** Moves a reminder from another seat onto this one (asking first when it stays put). */
		onMove: (reminderId: ReminderId, toSeatId: SeatId) => void;
	}

	let { open = $bindable(), grimoire, seatId, title, onRemove, onMove }: Props = $props();

	const characters = $derived(grimoire.open.characters);
	const groups = $derived(reminderGroups(grimoire.game, characters));
	// Each token can be placed once unless the game gives more copies; used-up ones stay in
	// place, disabled, so nothing moves.
	const left = $derived(reminderCopiesLeft(grimoire.game, characters));
	const usedUp = (reminder: Reminder) => (left.get(reminderKey(reminder)) ?? 1) <= 0;
	// Several copies of one token are shown one by one, or as one token with a count when the
	// Storyteller turns on "Stack duplicate reminders" (Trevor, 2026-10-16).
	const total = $derived(reminderCopies(grimoire.game, characters));
	const stack = $derived(preferences.current.assistance.stackReminders);
	/** This seat's reminders, by key: tapping one of these takes it off (Trevor, 2026-10-16). */
	const here = $derived.by(() => {
		const out: Record<string, ReminderId[]> = {};
		for (const r of seatId ? (grimoire.game.seats[seatId]?.reminders ?? []) : [])
			(out[reminderKey(r)] ??= []).push(r.reminderId);
		return out;
	});
	const onSeat = (reminder: Reminder) => here[reminderKey(reminder)]?.length ?? 0;
	/**
	 * Copies on other seats, by key, in seating order: each shows who has it, and a tap moves
	 * it here (Trevor, 2026-10-16).
	 */
	const elsewhere = $derived.by(() => {
		const out: Record<string, { reminderId: ReminderId; seatId: SeatId }[]> = {};
		for (const id of grimoire.game.seating) {
			if (id === seatId) continue;
			for (const r of grimoire.game.seats[id].reminders)
				(out[reminderKey(r)] ??= []).push({ reminderId: r.reminderId, seatId: id });
		}
		return out;
	});
	const holderName = (id: SeatId) =>
		grimoire.game.seats[id]?.playerName ?? `Seat ${grimoire.game.seating.indexOf(id) + 1}`;
	interface Copy {
		/** Placed on another seat, or none left: shown faded. */
		done: boolean;
		/** The seat a placed copy is on: a tap moves it here. */
		holder?: { reminderId: ReminderId; seatId: SeatId };
		/** On this seat: shown selected, and a tap takes it off. */
		on: boolean;
		count?: number;
		label?: string;
	}
	/**
	 * The chips for one token: one per copy (free ones first, then those on this seat, then
	 * those on other seats), or one stacked chip.
	 */
	function copies(reminder: Reminder): Copy[] {
		const key = reminderKey(reminder);
		const all = total.get(key) ?? 1;
		const free = Math.max(0, left.get(key) ?? 1);
		const mine = onSeat(reminder);
		const state = (i: number) => ({ done: i >= free + mine, on: i >= free && i < free + mine });
		if (stack && all > 1)
			return [
				{
					done: free === 0 && mine === 0,
					on: mine > 0,
					count: free,
					// eslint-disable-next-line grim/names-as-badges -- accessible name (aria-label)
					label: `${reminder.label}, ${free} left`
				}
			];
		const held = elsewhere[key] ?? [];
		return Array.from({ length: all }, (_, i) => {
			const holder = held[i - free - mine];
			return {
				...state(i),
				holder,
				label: holder
					? // eslint-disable-next-line grim/names-as-badges -- accessible name (aria-label)
						`${reminder.label}, on ${holderName(holder.seatId)}: move here`
					: all > 1
						? // eslint-disable-next-line grim/names-as-badges -- accessible name (aria-label)
							`${reminder.label}, copy ${i + 1} of ${all}`
						: undefined
			};
		});
	}
	/**
	 * The top row: the reminders on this seat now, in the order placed (Trevor, 2026-10-17:
	 * "should show active reminders"); one taken off leaves the row. A tap takes it off.
	 */
	const onThisSeat = $derived(seatId ? (grimoire.game.seats[seatId]?.reminders ?? []) : []);

	/**
	 * Adds a reminder, or takes it off when it is on this seat, keeping the picker open so
	 * several can be changed in a row.
	 */
	function toggle(reminder: Reminder, copy: Copy) {
		if (!seatId) return;
		if (copy.holder) {
			onMove(copy.holder.reminderId, seatId);
			return;
		}
		if (copy.on) {
			const ids = here[reminderKey(reminder)] ?? [];
			if (ids.length > 0) onRemove(ids[ids.length - 1]);
			return;
		}
		grimoire.run({ type: 'AddReminder', seatId, reminder });
	}

	/**
	 * Another copy of a script character's reminder, once every listed one is placed (Trevor,
	 * 2026-10-17: Cleopatra chooses two players but her JSON lists one "Chosen").
	 */
	function addCopy(reminder: Reminder) {
		if (seatId) grimoire.run({ type: 'AddReminder', seatId, reminder });
	}

	/**
	 * A token that doesn't usually go on this seat (the Investigator's own Wrong) is marked with
	 * a dashed edge; it can still be placed, and the board then says why (warn, never lock).
	 */
	const misfit = (reminder: Reminder) =>
		seatId !== undefined && seatMisses(grimoire.game, reminder, seatId, characters).length > 0;

	const placed = $derived(seatId ? (grimoire.game.seats[seatId]?.reminders.length ?? 0) : 0);
</script>

<Dialog bind:open title={`Reminders for ${title}`} size="full">
	<div class="head">
		<p class="count" aria-live="polite">On this seat: {placed}</p>
		<!-- A fixed-height row, so the list below never moves. -->
		<div class="recent" role="group" aria-label="On this seat">
			{#each onThisSeat as reminder (reminder.reminderId)}
				<button
					type="button"
					class="chip"
					aria-label={`${reminder.label}: take off`}
					aria-pressed="true"
					onclick={() => onRemove(reminder.reminderId)}
				>
					<ReminderToken label={reminder.label} character={characters.get(reminder.characterId)} />
				</button>
			{:else}
				<span class="none">None</span>
			{/each}
		</div>
	</div>
	<ul class="list">
		{#each groups as group (group.character.id)}
			<li>
				<span class="who">
					<CharacterToken character={group.character} size={32} />
					<!-- eslint-disable-next-line grim/names-as-badges -- caption beside its own token; a badge would repeat the icon -->
					<span class="name">{group.character.name}</span>
				</span>
				<span class="chips" role="group" aria-label={group.character.name}>
					{#each group.labels as label (label)}
						{@const reminder = { characterId: group.character.id, label }}
						{#each copies(reminder) as copy, i (i)}
							<button
								type="button"
								class="chip"
								class:misfit={!copy.on && misfit(reminder)}
								data-misfit={!copy.on && misfit(reminder) ? '' : undefined}
								aria-label={copy.label}
								title={!copy.on && misfit(reminder) ? 'Not a usual place for it' : undefined}
								aria-pressed={copy.on}
								disabled={copy.done && !copy.holder}
								onclick={() => toggle(reminder, copy)}
							>
								<ReminderToken {label} character={group.character} done={copy.done} />
								{#if copy.count !== undefined}<span class="count-badge" aria-hidden="true"
										>×{copy.count}</span
									>{/if}
								<!-- Who has it; the line is kept when empty, so nothing moves. -->
								<span class="holder" aria-hidden="true" data-testid="reminder-holder"
									>{copy.holder ? holderName(copy.holder.seatId) : ''}</span
								>
							</button>
						{/each}
						<!-- Always there for a script's own character, so nothing moves when it is needed. -->
						{#if canAddCopy(group.character)}
							<button
								type="button"
								class="chip another"
								aria-label={`Add another ${label}`}
								disabled={!usedUp(reminder)}
								onclick={() => addCopy(reminder)}><Icon name="add" /></button
							>
						{/if}
					{/each}
				</span>
			</li>
		{/each}
	</ul>
</Dialog>

<style>
	.chip:disabled {
		cursor: default;
		opacity: 0.55;
	}
	.head {
		display: grid;
		gap: var(--space-1);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.count {
		margin: 0;
		font-size: 0.85rem;
		opacity: 0.8;
	}
	.recent {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		height: var(--tap-target);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.none {
		font-size: 0.85rem;
		opacity: 0.7;
	}
	.list {
		flex: 1;
		min-height: 0;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		list-style: none;
	}
	.list li {
		display: grid;
		/* The chips column may shrink, so its chips wrap instead of widening the dialog. */
		grid-template-columns: minmax(calc(8 * var(--u)), 35%) minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
		padding: calc(0.125 * var(--u)) 0;
		border-bottom: 1px solid var(--border);
	}
	.who {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		min-width: 0;
	}
	.name {
		overflow: hidden;
		font-family: var(--font-character);
		font-size: 0.85rem;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
		padding: var(--space-1) 0;
	}
	/* Big, easy targets (Trevor, 2026-10-16), following the Reminder size setting. */
	.chip {
		display: inline-grid;
		place-items: center;
		min-width: calc(3.25 * var(--u) * var(--reminder-scale, 1));
		min-height: calc(3.25 * var(--u) * var(--reminder-scale, 1));
		padding: 0 calc(0.125 * var(--u));
		border: 0;
		background: none;
		cursor: pointer;
	}
	.chip {
		position: relative;
	}
	.holder {
		max-width: calc(5 * var(--u) * var(--reminder-scale, 1));
		min-height: 1.5em;
		padding: 0 0.5em;
		overflow: hidden;
		border-radius: var(--radius-full);
		font-size: 0.75rem;
		line-height: 1.5;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.holder:not(:empty) {
		border: 1px solid var(--border);
		background: var(--surface-raised);
		color: var(--on-surface);
	}
	.count-badge {
		position: absolute;
		top: 0;
		right: 0;
		min-width: 1.4em;
		padding: 0 calc(0.1875 * var(--u));
		border-radius: var(--radius-full);
		background: var(--accent);
		color: var(--on-accent);
		font: 700 0.75rem / 1.4 var(--font-control);
		text-align: center;
	}
	/* On this seat: selected, with a ring that hugs the token; a tap takes it off. */
	.chip[aria-pressed='true'] > :global(.reminder) {
		outline: 0.2rem solid var(--accent);
		outline-offset: 0.1rem;
	}
	/* Not a usual place for it: dashed and faded, still tappable. */
	.misfit > :global(.reminder) {
		outline: 0.15rem dashed var(--on-surface);
		outline-offset: 0.1rem;
		opacity: 0.6;
	}
	.another {
		color: var(--on-surface);
		--icon-size: 1.5rem;
	}
	.chip:hover {
		filter: brightness(1.15);
	}
	.chip > :global(.reminder) {
		padding: 0.45em 0.7em 0.45em 0.45em;
		font-size: calc(1rem * var(--reminder-scale, 1));
	}
	.recent {
		height: calc(3.25 * var(--u) * var(--reminder-scale, 1));
	}
</style>

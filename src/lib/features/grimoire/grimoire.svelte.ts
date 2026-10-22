import type { Command } from '#lib/core/engine/index.ts';
import { demonToBecome, foolSurvives, type Night } from '#lib/core/rules/index.ts';
import { doneKey } from './night-steps.ts';
import { alignmentOf, replacedBy, scriptCharacterIds, type SeatId } from '#lib/core/model/index.ts';
import type { CharacterId } from '#lib/core/data/index.ts';
import { keepIconsOffline } from '#lib/features/offline/keep-offline.ts';
import type { OpenGame } from '#lib/features/game/session.svelte.ts';
import { toast } from '#lib/ui/primitives/toaster.ts';
import { reminderFitWarning, warningText } from './board.ts';
import { reminderKey } from './reminders.ts';
import {
	DEFAULT_SEAT_LAYOUT,
	type SeatLayout,
	type SeatPoint
} from '#lib/ui/seating/seat-layout.ts';
import type { Reminder, ReminderId } from '#lib/core/model/index.ts';
import {
	bankCopies,
	forgetUpsideDownMarks,
	nightViews,
	pastNames,
	reminderCopyIds,
	reminderSpots,
	seatLayouts,
	type NightView
} from './device-notes.ts';

/**
 * The grimoire board's controller: runs commands on the open game and shows warnings and
 * refusals as toasts (overlays, so the board never moves), plus the device-only seat
 * layout.
 */
export class Grimoire {
	layout = $state.raw<SeatLayout>(DEFAULT_SEAT_LAYOUT);

	constructor(readonly open: OpenGame) {
		forgetUpsideDownMarks();
		this.layout = seatLayouts.read(open.game.gameId);
		this.reminderSpots = reminderSpots.read(open.game.gameId);
		this.copies = reminderCopyIds.read(open.game.gameId);
		this.bankCopies = bankCopies.read(open.game.gameId);
		this.nightView = nightViews.read(open.game.gameId);
		this.nightDone = this.nightView.done;
		this.nightDay = this.nightView.day ?? open.game.pastDays.length;
		// Icons are stored only once shown; store the ones this game may need mid-game, so
		// the Traveller and Fabled pickers and an older game's script work offline.
		const onScript = scriptCharacterIds(open.game.script);
		keepIconsOffline(
			[...open.characters.values()].filter(
				(c) =>
					c.type === 'traveller' ||
					c.type === 'fabled' ||
					c.type === 'loric' ||
					onScript.includes(c.id)
			)
		);
	}

	/**
	 * Night steps the Storyteller ticked off (`<night>:<step id>`), kept on this device with
	 * the night order view (`nightViews`); the night order never ticks anything by itself.
	 */
	nightDone = $state.raw<readonly string[]>([]);
	/** The night as it was saved on this device, for the board to reopen after a reload. */
	readonly nightView: NightView;

	/**
	 * The night being run, by the number of days before it. It is kept while the night order
	 * is open, so ticking Dawn (which starts a new day) doesn't clear the night's ticks.
	 */
	nightDay = $state(0);

	/** Saves which night order view is open, with the ticks. */
	saveNightView(view: Omit<NightView, 'done' | 'day'>): void {
		nightViews.write(this.game.gameId, {
			...view,
			day: this.nightDay,
			done: [...this.nightDone]
		});
	}

	/** Opening the night order runs tonight's night. */
	beginNight(): void {
		this.nightDay = this.game.pastDays.length;
	}

	isNightStepDone(night: Night, step: { id: string }): boolean {
		return this.nightDone.includes(doneKey(this.nightDay, night, step));
	}

	/**
	 * Ticks or unticks a night step. Ticking Dawn ends the night and starts a new day
	 * (Trevor, 2026-10-16), once a night; History's Restore undoes it. The board's
	 * walk-through ticks Dawn without it (`startDay: false`): its End night starts the day.
	 */
	toggleNightStep(night: Night, step: { id: string }, { startDay = true } = {}): void {
		if (this.open.viewOnly) {
			toast('Not done', this.open.readOnlyMessage);
			return;
		}
		const key = doneKey(this.nightDay, night, step);
		const ticking = !this.nightDone.includes(key);
		this.nightDone = ticking ? [...this.nightDone, key] : this.nightDone.filter((k) => k !== key);
		nightViews.write(this.game.gameId, {
			...nightViews.read(this.game.gameId),
			day: this.nightDay,
			done: [...this.nightDone]
		});
		if (startDay && ticking && step.id === 'dawn' && this.nightDay === this.game.pastDays.length)
			this.run({ type: 'NewDay' });
	}

	/**
	 * Tonight's night is running: Dusk is ticked (Run night's walk-through or the day's End
	 * day) and no new day has started since.
	 */
	get nightRunning(): boolean {
		const night = this.game.pastDays.length === 0 ? 'first' : 'other';
		return (
			this.nightDay === this.game.pastDays.length && this.isNightStepDone(night, { id: 'dusk' })
		);
	}

	/**
	 * Tonight's night has begun: a step of it is ticked and no new day has started since.
	 * The bank's button then picks the walk-through up again (Run night) rather than offering
	 * Start game or End day.
	 */
	get nightUnderway(): boolean {
		const today = `${this.game.pastDays.length}:`;
		return (
			this.nightDay === this.game.pastDays.length &&
			this.nightDone.some((key) => key.startsWith(today))
		);
	}

	/**
	 * Ends tonight's night and starts a new day, from the board's End night button (Trevor,
	 * 2026-10-18; it replaces ticking Dawn). Once a night; History's Restore undoes it.
	 */
	endNight(): boolean {
		if (this.open.viewOnly) {
			toast('Not done', this.open.readOnlyMessage);
			return false;
		}
		if (this.nightDay !== this.game.pastDays.length) return false;
		return this.run({ type: 'NewDay' });
	}

	/** Setup reminder suggestions the Storyteller dismissed from the tray (`setup-tray.ts`). */
	trayDismissed = $state.raw<readonly string[]>([]);

	dismissTray(key: string): void {
		if (!this.trayDismissed.includes(key)) this.trayDismissed = [...this.trayDismissed, key];
	}

	/** Where reminders were dropped, for reminders that stay where they are dropped. */
	reminderSpots = $state.raw<Readonly<Record<string, SeatPoint>>>({});
	/**
	 * Reminders made with Duplicate reminder (device-only, `reminderCopyIds`). Replaced, never
	 * changed in place, so a plain Set is enough.
	 */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	copies = $state.raw<ReadonlySet<ReminderId>>(new Set());

	/** Marks a reminder as a duplicate, a token beyond the game's own. */
	markCopy(reminderId: ReminderId): void {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		this.copies = new Set([...this.copies, reminderId]);
		reminderCopyIds.write(this.game.gameId, this.copies);
	}

	/**
	 * Copies added to the reminder bank by key (device-only, `bankCopies`): a Duplicate
	 * reminder lands in the bank (Trevor, 2026-10-20). Replaced, never changed in place.
	 */
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	bankCopies = $state.raw<ReadonlyMap<string, number>>(new Map());

	/** Adds one more copy of a reminder to the bank. */
	addBankCopy(reminder: Reminder): void {
		const key = reminderKey(reminder);
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const next = new Map(this.bankCopies);
		next.set(key, (next.get(key) ?? 0) + 1);
		this.bankCopies = next;
		bankCopies.write(this.game.gameId, next);
	}

	setReminderSpot(reminderId: ReminderId, at: SeatPoint): void {
		this.reminderSpots = { ...this.reminderSpots, [reminderId]: at };
		reminderSpots.write(this.game.gameId, this.reminderSpots);
	}

	/** Changes where seats are drawn on this device; the seating order is untouched. */
	setLayout(layout: SeatLayout): void {
		this.layout = layout;
		seatLayouts.write(this.game.gameId, layout);
	}

	get game() {
		return this.open.game;
	}

	/** Runs a command; returns whether it was accepted. */
	run(command: Command): boolean {
		const misfit = this.misfit(command);
		const result = this.open.run(command);
		if (!result.ok) {
			toast('Not done', result.error.message);
			return false;
		}
		for (const warning of result.warnings) {
			const text = warningText(warning);
			if (text) toast('Note', text);
		}
		if (misfit) toast('Note', misfit);
		this.askAlignment(command);
		this.askDemon(command);
		this.askFool(command);
		return true;
	}

	/** The seat and reminder an AddReminder or MoveReminder just put down. */
	private placed(command: Command): { seatId: SeatId; reminder: Reminder } | undefined {
		if (command.type !== 'AddReminder' && command.type !== 'MoveReminder') return undefined;
		const seatId = command.type === 'AddReminder' ? command.seatId : command.toSeatId;
		const reminder = this.open.game.seats[seatId]?.reminders.find((r) =>
			command.type === 'AddReminder'
				? r.characterId === command.reminder.characterId && r.label === command.reminder.label
				: r.reminderId === command.reminderId
		);
		return reminder ? { seatId, reminder } : undefined;
	}

	/**
	 * A seat whose reminder says it became the Demon (the Scarlet Woman's "Is The Demon"):
	 * the board offers to change its character to that Demon (Trevor, 2026-10-19).
	 */
	demonAsk = $state.raw<{ seatId: SeatId; characterId: CharacterId } | undefined>();

	/**
	 * A Fool just marked dead whose ability is unused and works (not by the Assassin): the
	 * board offers to keep them alive and spend the ability (`foolSurvives`; Trevor,
	 * 2026-10-22).
	 */
	foolAsk = $state.raw<{ seatId: SeatId } | undefined>();

	private askFool(command: Command): void {
		const death =
			command.type === 'SetDead' && command.dead
				? { seatId: command.seatId, cause: command.cause }
				: command.type === 'Execute'
					? { seatId: command.seatId, cause: 'execution' as const }
					: undefined;
		if (!death || !this.open.game.seats[death.seatId]?.dead) return;
		if (foolSurvives(this.open.game, death.seatId, death.cause, this.open.characters))
			this.foolAsk = { seatId: death.seatId };
	}

	private askDemon(command: Command): void {
		const placed = this.placed(command);
		if (!placed) return;
		const characterId = demonToBecome(
			this.open.game,
			placed.seatId,
			placed.reminder,
			this.open.characters
		);
		if (characterId) this.demonAsk = { seatId: placed.seatId, characterId };
	}

	/**
	 * A seat the Storyteller just marked as truly an evil character (Marionette, Trevor
	 * 2026-10-17) whose alignment isn't evil yet: the board asks whether to make it evil.
	 */
	alignmentAsk = $state.raw<{ seatId: SeatId; characterId: CharacterId } | undefined>();

	private askAlignment(command: Command): void {
		const placed = this.placed(command);
		if (!placed) return;
		const game = this.open.game;
		const { seatId } = placed;
		const source = replacedBy(placed.reminder, this.open.characters);
		if (!source || (source.type !== 'minion' && source.type !== 'demon')) return;
		if (alignmentOf(game, seatId) === 'evil') return;
		this.alignmentAsk = { seatId, characterId: source.id };
	}

	/**
	 * Reminder target rules (Trevor, 2026-10-16): a reminder put on a seat that doesn't fit it
	 * is still placed, with a toast saying why, wherever it was placed from.
	 */
	private misfit(command: Command): string | undefined {
		const game = this.open.game;
		const characters = this.open.characters;
		if (command.type === 'AddReminder')
			return reminderFitWarning(game, command.reminder, command.seatId, characters);
		if (command.type === 'MoveReminder') {
			for (const seatId of game.seating) {
				const r = game.seats[seatId].reminders.find((x) => x.reminderId === command.reminderId);
				if (r) return reminderFitWarning(game, r, command.toSeatId, characters);
			}
		}
		return undefined;
	}

	rename(seatId: SeatId, name: string): void {
		if (this.run({ type: 'RenameSeat', seatId, playerName: name })) pastNames.remember(name);
	}

	/** Adds a seat at the end of the seating order; returns its id. */
	/** Adds a seat at `position` in the seating order (the end when left out). */
	addSeat(position?: number): SeatId | undefined {
		const before = this.game.seating;
		if (!this.run({ type: 'AddSeat', ...(position !== undefined ? { position } : {}) }))
			return undefined;
		return this.game.seating.find((id) => !before.includes(id));
	}

	removeSeat(seatId: SeatId): void {
		this.run({ type: 'RemoveSeat', seatId });
	}
}

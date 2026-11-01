/**
 * Test support only (never import from app code): the one way the rules tests write a wiki
 * example (Trevor, 2026-10-31: "a unified framework for making these example tests", M13a).
 *
 * An example is three parts, in this order:
 * 1. who sits where: `scenario([...characters])`, one named seat per character in seating
 *    order (Ana, Ben, Cat, ...), on the test script;
 * 2. what has happened: steps such as `.drunk('chef')`, `.poisoned(1)`, `.dies('king')`,
 *    `.nominate('chef', 'imp')`, `.execute('imp')`, `.newDay()`, or any engine command with
 *    `.do(...)`;
 * 3. what the rules say now: `expect` on the scenario's `game`, calling the rule under test
 *    (`infoPicker`, `gameEnds`, `madnessOffer`, ...) with `characters`.
 *
 * A seat is named by its place in the cast (0 is the first) or by the character sitting there
 * ('imp'), whichever reads better. Each step returns a new scenario, so one game can branch
 * into a before and an after. A refused command throws, naming it.
 *
 *   it('Example 2: Drunk Choirboy wrongly names the General', () => {
 *     // A Drunk who thinks they are the Choirboy may be shown anyone as the Demon.
 *     const s = scenario(['choirboy', 'king', 'shabaloth', 'general']).drunk('choirboy').dies('king');
 *     const picker = infoPicker(s.game, s.seat('choirboy'), 'choirboy', s.characters)!;
 *     expect(isAllowed(picker, { seats: [s.seat('general')] })).toBe(true);
 *   });
 *
 * The scaffold (`npm run scaffold:rules-tests`) writes new test files with this import.
 */
import type { Alignment, CharacterId, ReminderLabel, Script } from '#lib/core/data/index.ts';
import type { Command, EngineContext, GameSession } from '#lib/core/engine/index.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import { castWith, run } from '#lib/core/model/fixtures.test-support.ts';
import type { DeathCause, Game, SeatId } from '#lib/core/model/types.ts';

/** A seat by its place in the cast (0 is the first) or by the character first cast there. */
export type SeatRef = number | CharacterId;

/** A game set up for one example, and the steps that move it on. */
export class Scenario {
	constructor(
		readonly session: GameSession,
		readonly ctx: EngineContext,
		/** Seat ids in seating order, one per cast character. */
		readonly seats: readonly SeatId[],
		private readonly cast: readonly CharacterId[]
	) {}

	/** The game as it stands. */
	get game(): Game {
		return this.session.game;
	}

	/** The characters the game knows: the test script's, official ones and any custom. */
	get characters(): CharacterLookup {
		return this.ctx.characters;
	}

	/** The seat id of a place in the cast, or of the seat a character was cast in. */
	seat(ref: SeatRef): SeatId {
		const index = typeof ref === 'number' ? ref : this.cast.indexOf(ref);
		const seatId = this.seats[index];
		if (seatId === undefined) throw new Error(`no seat ${String(ref)} in this scenario`);
		return seatId;
	}

	/** Runs engine commands; each may be a function of the scenario, to read the game. */
	do(...commands: (Command | ((s: Scenario) => Command))[]): Scenario {
		return commands.reduce<Scenario>((at, command) => {
			const resolved = typeof command === 'function' ? command(at) : command;
			return new Scenario(run(at.session, at.ctx, resolved), at.ctx, at.seats, at.cast);
		}, this);
	}

	/** Puts `characterId`'s `label` reminder on a seat. */
	reminder(on: SeatRef, characterId: CharacterId, label: ReminderLabel): Scenario {
		return this.do({
			type: 'AddReminder',
			seatId: this.seat(on),
			reminder: { characterId, label }
		});
	}

	/** The Poisoner's Poisoned reminder on a seat. */
	poisoned(on: SeatRef): Scenario {
		return this.reminder(on, 'poisoner', 'Poisoned');
	}

	/** The Drunk's Is The Drunk reminder on a seat: they think they are the character cast. */
	drunk(on: SeatRef): Scenario {
		return this.reminder(on, 'drunk', 'Is The Drunk');
	}

	/** Marks a seat dead, by `cause` when given (a death cause or the character that killed). */
	dies(on: SeatRef, cause?: DeathCause): Scenario {
		return this.do({
			type: 'SetDead',
			seatId: this.seat(on),
			dead: true,
			...(cause === undefined ? {} : { cause })
		});
	}

	/** Changes a seat's character, and its alignment when given. */
	becomes(on: SeatRef, characterId: CharacterId, alignment?: Alignment): Scenario {
		return this.do({
			type: 'AssignCharacter',
			seatId: this.seat(on),
			characterId,
			...(alignment ? { alignment } : {})
		});
	}

	/** Puts a Fabled or Loric in play. */
	rule(characterId: CharacterId): Scenario {
		return this.do({ type: 'AddRuleCharacter', characterId });
	}

	/** Logs a nomination. */
	nominate(by: SeatRef, nominee: SeatRef): Scenario {
		return this.do({ type: 'Nominate', nominator: this.seat(by), nominee: this.seat(nominee) });
	}

	/** Records whom the latest nominee chose (the Big Wig's speaker). */
	nomineeChose(chosen: SeatRef): Scenario {
		const latest = this.game.today.entries.findLast((e) => e.kind === 'nomination');
		if (!latest) throw new Error('nomineeChose needs a nomination first');
		return this.do({
			type: 'ChooseForNomination',
			entryId: latest.entryId,
			chosen: this.seat(chosen)
		});
	}

	/** Executes a seat. */
	execute(on: SeatRef): Scenario {
		return this.do({ type: 'Execute', seatId: this.seat(on) });
	}

	/** Starts a new day: today's log moves to the past days. */
	newDay(): Scenario {
		return this.do({ type: 'NewDay' });
	}
}

/**
 * A scenario: one named seat per character in `cast`, in seating order, on the test script
 * (or `options.script`, whose characters are used unless `options.characters` is given).
 */
export function scenario(
	cast: CharacterId[],
	options: { script?: Script; characters?: CharacterLookup } = {}
): Scenario {
	const { session, ctx, seats } = castWith(options)(cast);
	return new Scenario(session, ctx, seats, cast);
}

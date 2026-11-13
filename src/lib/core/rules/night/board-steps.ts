/**
 * The night order for a game on the board: the characters in play that wake tonight, in
 * order, with TPI's night text, and who wakes for each step. Pure rules, shared by the
 * Storyteller's board (Night order sheet, guided step, walk-through strip), the player view and
 * the whole-game tests; the step names and icons stay with the board (refactor review G1).
 */
import { isSeatable } from '#lib/core/data/character-type.ts';
import type { DeadKeepAbilities } from '#lib/core/data/character-rules.ts';
import type { GameData } from '#lib/core/data/game-data.ts';
import type { Character, CharacterId } from '#lib/core/data/types.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Night } from '#lib/core/model/overrides.ts';
import { trueCharacter } from '#lib/core/model/selectors.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import { withActsTwiceSteps } from '#lib/core/rules/abilities/acts-twice.ts';
import { notDealtInPlay } from '#lib/core/rules/setup/bag-characters.ts';
import { withCharacterChangeSteps } from '#lib/core/rules/night/character-changes.ts';
import { keepsAbilityWhenDead } from '#lib/core/rules/abilities/dead-characters.ts';
import { livesWhileDead } from '#lib/core/rules/game-end/game-end-helpers.ts';
import { evilInfoNotesLeftOut } from '#lib/core/rules/jinxes/holder-jinxes.ts';
import { jinxRulesBetween } from '#lib/core/rules/jinxes/jinx-pairs.ts';
import { notDeclared } from '#lib/core/rules/jinxes/jinxes.ts';
import { onDeathApplies, onDeathTrigger } from './night-killers.ts';
import {
	characterStepSeats,
	wakesMarked,
	withNightInfo
} from '#lib/core/rules/night/info/steps.ts';
import {
	nightOrder,
	sheetWithOwnPlaces,
	type NightStep
} from '#lib/core/rules/night/night-order.ts';
import { pretendSeatsOf, pretendTeam } from '#lib/core/rules/abilities/pretend.ts';
import { revivedAfterStep } from '#lib/core/rules/night/revived-tonight.ts';
import {
	oneNightWakesOn,
	ruleSources,
	seatHasAbility,
	type RuleFile,
	type RuleSource
} from '#lib/core/rules/rule-sources.ts';
import { rulesFor } from '#lib/core/rules/rules-for.ts';
import { wakeConditionMet } from '#lib/core/rules/night/wakes-when.ts';
import { infoDelayOf, withHeldInfoSteps } from '#lib/core/rules/night/info/held-info.ts';

export function boardNightSteps(
	game: Game,
	characters: CharacterLookup,
	night: Night,
	data: GameData,
	/**
	 * Since the most recent New day, from the log: seats whose character changed
	 * (`changedCharacters`), each woken tonight, and who died (`diedToday`), for the Godfather.
	 */
	today: {
		changes?: readonly { seatId: SeatId; characterId: CharacterId; by?: CharacterId }[];
		died?: readonly SeatId[];
		revived?: readonly SeatId[];
	} = {},
	/** The game's mode and special rules, for the steps they add to a night (Council of the Dead). */
	rules: readonly RuleFile[] = []
): NightStep[] {
	// Players wake by the token they hold (a Drunk wakes as their Townsfolk).
	const inPlay: Character[] = [];
	for (const id of [
		...game.seating.map((s) => game.seats[s].characterId),
		...game.ruleCharacters
	]) {
		const c = id ? characters.get(id) : undefined;
		if (c) inPlay.push(c);
	}
	// A never-dealt character in play wakes too, though no seat holds it (Lil' Monsta, M41).
	for (const id of notDealtInPlay(game, characters)) {
		const c = characters.get(id);
		if (c) inPlay.push(c);
	}
	const order = (pretending: readonly Character[]) =>
		nightOrder({
			night,
			sheet: data.nightSheet,
			official: data.byId,
			inPlay: [...inPlay, ...pretending],
			players: inPlay.filter((c) => isSeatable(c.type) && c.type !== 'traveller').length,
			customOrder: night === 'first' ? game.script.meta?.firstNight : game.script.meta?.otherNight,
			overrides: game.nightOrderOverrides,
			noAbility: evilInfoNotesLeftOut(game, characters)
		}).steps;
	// The Storyteller's pretend evil team (M26) wakes too, so the table hears it: a step for each
	// pretend character no one really is. Only its own steps: the night's markers (Minion info,
	// Demon info) stay as the real players make them.
	const real = order([]);
	const pretending = pretendTeam(game, characters)
		.map((p) => characters.get(p.characterId))
		.filter((c): c is Character => !!c && !inPlay.some((d) => d.id === c.id));
	const realIds = new Set(real.map((s) => s.id));
	const sheet =
		pretending.length === 0
			? real
			: order(pretending).flatMap((s): NightStep[] =>
					realIds.has(s.id)
						? [s]
						: s.kind === 'character' && pretending.some((c) => c.id === s.id)
							? [{ ...s, pretend: true }]
							: []
				);
	// A jinx may say the Storyteller doesn't declare a character after Dawn (the Vizier with
	// the Alsaahir or the Investigator, L115): its announcement step is left out.
	const steps = sheet.filter(
		(s) => !(s.afterDawn && s.character && notDeclared(game, s.character.id, characters))
	);
	// What the game says for each step (suggested answers, impairments), a step for each
	// gained ability, and a step to choose any Traveller's alignment still unset. Dawn is the
	// last step (Trevor, 2026-10-20); the board's End night button still ends the night.
	// A player whose character changed since dawn wakes before Dawn to learn it; changes only
	// count after the first New day, so only other nights have them.
	const woken =
		night === 'other'
			? withCharacterChangeSteps(game, steps, today.changes ?? [], characters)
			: steps;
	const number = night === 'first' ? 1 : game.pastDays.length + 1;
	// A player whose ability works twice tonight wakes again straight after each of their steps.
	const sources = ruleSources(game, characters, rules);
	return duskToDawn([
		...ruleNightSteps(sources, number),
		// Under a rule that delays information (One Day More), a player wakes to receive last
		// night's even when their character doesn't wake tonight.
		...withHeldInfoSteps(
			withActsTwiceSteps(
				withNightInfo(
					woken,
					game,
					characters,
					night,
					{ died: today.died ?? [], revived: today.revived ?? [] },
					sheetWithOwnPlaces(
						data.nightSheet[night === 'first' ? 'firstNight' : 'otherNight'],
						night,
						[...data.byId.values(), ...characters.values()]
					)
				),
				game,
				characters
			),
			game,
			characters,
			night === 'first' ? undefined : infoDelayOf(sources)?.rule
		)
	]);
}

/**
 * The steps rule sources add to night `number`, right after Dusk: a one-night wake for the dead
 * (`nightWakes`, Council of the Dead, https://beardytas.com/garden-of-djinn/council-of-the-dead/)
 * or for a player the Storyteller picks (The Ballad of Seat 7's Grandmother Principle), headed by
 * the source's name, with the wake's own line or the rule's lines as its text. A Fabled or Loric with one
 * adds it the same way.
 */
export function ruleNightSteps(sources: readonly RuleSource[], number: number): NightStep[] {
	return oneNightWakesOn(sources, number).map(({ source, wake, index }) => ({
		id: `rule:${source.id}:${index}`,
		kind: 'custom' as const,
		title: source.name,
		reminder: wake.text || (source.text ?? []).join(' ') || undefined,
		afterDawn: false,
		placement: 'marker' as const,
		notes: []
	}));
}

/**
 * Dusk is always the first step and Dawn the last (Trevor, 2026-10-16; 2026-11-04: "dawn
 * should always be last"); everything else, Traveller alignment included, falls between them.
 * TPI's few "after Dawn" steps (the Leviathan's and Vizier's announcements to everyone) come
 * just before Dawn, still marked to be said once the night is over and never numbered.
 */
function duskToDawn<T extends NightStep>(steps: readonly T[]): T[] {
	const dusk = steps.filter((s) => s.id === 'dusk');
	const dawn = steps.filter((s) => s.id === 'dawn');
	const rest = steps.filter((s) => s.id !== 'dusk' && s.id !== 'dawn');
	return [
		...dusk,
		...rest.filter((s) => !s.afterDawn),
		...rest.filter((s) => s.afterDawn),
		...dawn
	];
}

/** Tonight: the first night until a day has been played, then the other nights. */
export const tonight = (game: Game): Night => (game.pastDays.length === 0 ? 'first' : 'other');

/**
 * Who wakes for a step, for "Empath · Sam" and the seats marked on the board: the holder of
 * the step's character, or for Minion info and Demon info every player who really is a
 * Minion or the Demon (Trevor, 2026-10-16), so a Drunk never shows as one.
 */
export function stepHolders(game: Game, step: NightStep, characters: CharacterLookup): SeatId[] {
	const wakes = step.id === 'minioninfo' ? 'minion' : step.id === 'demoninfo' ? 'demon' : undefined;
	if (wakes) {
		return game.seating.filter((s) => {
			const id = trueCharacter(game, s, characters);
			return id !== undefined && characters.get(id)?.type === wakes;
		});
	}
	if (step.changed) return [step.changed.seatId];
	if (step.again) return [step.again.seatId];
	if (step.pretend && step.character) return pretendSeatsOf(game, step.character.id, characters);
	// Starting alignment: the players who start with the other alignment (the evil Townsfolk).
	if (step.setupAlignments) return step.setupAlignments.flatMap((t) => t.seats);
	const id = step.character?.id;
	return id ? characterStepSeats(game, id, characters) : [];
}

/**
 * Whether a step wakes anyone tonight, for Run Night Order and the leaf numbers: a step for
 * no player (Dusk, Dawn), or one with a player who has their ability (alive, or as a special
 * rule says), a dead player another character's token keeps it for (`keepsAbility`: the
 * Vigormortis's Has Ability on a Minion it killed, https://wiki.bloodontheclocktower.com/Vigormortis),
 * a dead player who still lives by their own ability (`livesWhileDead`: the Zombuul after its
 * first death), or one dead since the day began whose ability that death sets off (`onDeath`:
 * the Ravenkeeper killed at night, not executed; the Sage killed by the Demon). A character's
 * own condition must hold too (`wakesWhen`: the King once the dead equal or outnumber the
 * living, the Choirboy when the Demon killed the King, the Seamstress until it is used). A step
 * that wakes the players its character marks wakes while anyone is marked.
 */
export function stepWakes(
	game: Game,
	step: NightStep,
	characters: CharacterLookup,
	tonight: {
		abilitiesRule?: DeadKeepAbilities;
		diedTonight: ReadonlySet<SeatId>;
		/** Seats whose character changed since the New day (`wakesWhen.becameToday`). */
		became?: ReadonlySet<SeatId>;
		revived?: ReadonlySet<SeatId>;
		order?: readonly string[];
	}
): boolean {
	const holders = stepHolders(game, step, characters);
	const id = step.character?.id;
	// A step that wakes the players its character marks (the Duchess's visitors) wakes only
	// when someone is marked: no visitors, no visits tonight.
	if (id !== undefined && !step.gained && wakesMarked(game, id, characters))
		return holders.length > 0;
	// An ability set off by its player's death (the Ravenkeeper, the Sage) wakes after the first
	// night only on the night of that death, never while its player lives. A jinx with a partner
	// in play may change that (the Leviathan's chosen Sage acts), so its step stays (warn, never
	// lock).
	const onDeath =
		id !== undefined &&
		game.pastDays.length > 0 &&
		onDeathTrigger(game, id, characters) !== undefined &&
		!jinxedInPlay(game, id, characters);
	// One whose death gives the Storyteller an ability (`givesAbility` to the Storyteller: the
	// Plague Doctor, https://wiki.bloodontheclocktower.com/Plague_Doctor) wakes every night after
	// that death until the ability is chosen, as TPI's night text asks ("if you haven't done this
	// yet"): a death on the first night, or after its step, would otherwise never offer it.
	const untilGiven =
		onDeath &&
		rulesFor(game, id, characters)?.givesAbility?.to === 'storyteller' &&
		!game.storytellerAbilities?.some((a) => a.via === id);
	return (
		holders.length === 0 ||
		holders.some(
			(s) =>
				(onDeath && id !== undefined
					? (tonight.diedTonight.has(s) || (untilGiven && !!game.seats[s]?.dead)) &&
						setOffByDeath(game, s, id, characters)
					: seatHasAbility(tonight.abilitiesRule, game, s, characters) ||
						keepsAbilityWhenDead(game, s, characters) ||
						livesWhileDead(game, s, characters)) &&
				(id === undefined ||
					wakeConditionMet(game, id, s, characters, tonight.diedTonight, tonight.became)) &&
				!(
					tonight.revived &&
					tonight.order &&
					revivedAfterStep(game, s, step.id, tonight.order, characters, tonight.revived)
				)
		)
	);
}

/** Whether a jinx between `characterId` and a character in play holds, on either of them. */
function jinxedInPlay(game: Game, characterId: CharacterId, characters: CharacterLookup): boolean {
	return game.seating.some((s) => {
		const other = trueCharacter(game, s, characters);
		return (
			other !== undefined &&
			other !== characterId &&
			(jinxRulesBetween(characterId, other, characters) !== undefined ||
				jinxRulesBetween(other, characterId, characters) !== undefined)
		);
	});
}

/** Whether `seatId`'s death, by its recorded cause, sets off `characterId`'s ability. */
function setOffByDeath(
	game: Game,
	seatId: SeatId,
	characterId: CharacterId,
	characters: CharacterLookup
): boolean {
	const trigger = onDeathTrigger(game, characterId, characters);
	return !!trigger && onDeathApplies(game, trigger, game.seats[seatId]?.deathCause, characters);
}

/**
 * The shape of a night step's alert (see `night-alerts.ts` for every kind) and the helpers
 * that build one from the ability behind it.
 */
import type { Alignment, CharacterId, CharacterType } from '#lib/core/data/types.ts';
import type { LearnsGained, NightChoice } from '#lib/core/data/jinx-rules.ts';
import { wikiUrl } from '#lib/core/data/wiki.ts';
import type { CharacterLookup } from '#lib/core/model/characters.ts';
import type { Game, SeatId } from '#lib/core/model/types.ts';
import {
	abilityState,
	type AbilitySource,
	type Impairment
} from '#lib/core/rules/abilities/ability.ts';

export type NightAlertKind =
	| 'impaired'
	| 'blocked'
	| 'acts-twice'
	| 'no-kill'
	| 'may-skip-attack'
	| 'must-skip-attack'
	| 'final-night'
	| 'no-grimoire'
	| 'grimoire-hides'
	| 'jinx-chosen'
	| 'learns-gained'
	| 'missing-token'
	| 'true-info'
	| 'seating'
	| 'wakes-with'
	| 'keeps-protection'
	| 'learns-no-ability'
	| 'might-learn'
	| 'storyteller-has'
	| 'guessed'
	| 'not-shown-given'
	| 'may-mad-as'
	| 'reverts'
	| 'partner-setup'
	| 'storyteller-chooses'
	| 'wakes-one-by-one'
	| 'learns-alignment'
	| 'learns-character'
	| 'cannot-choose'
	| 'storyteller-redirects'
	| 'protected'
	| 'may-bounce'
	| 'survives-first-death'
	| 'on-death';

/**
 * The alerts about what happens to a player if a killing step chooses them: protected, may
 * bounce the death, survives a first death, or dying sets off an ability. The night step shows
 * them in their own "If chosen" section, one row per player (Trevor, 2026-11-03).
 */
export const IF_CHOSEN_KINDS: ReadonlySet<NightAlertKind> = new Set([
	'protected',
	'may-bounce',
	'survives-first-death',
	'on-death'
]);

export interface NightAlert {
	kind: NightAlertKind;
	/** The player the alert is about: the waking player, or one who might die. */
	seatId: SeatId;
	/** Whose ability it is; 'override' for the Storyteller's "can die" override. */
	source: AbilitySource | 'override';
	/** Whether the source's ability works now; when not, it does nothing tonight. */
	works: boolean;
	/** Why the source's ability does not work (empty when it works). */
	impairments: Impairment[];
	wiki?: string;
	/** For `jinx-chosen`: whether the chosen partner acts without dying, or dies. */
	outcome?: NightChoice['partner'];
	/** For `learns-gained`: what the player learns, the ability or its answer. */
	learns?: LearnsGained;
	/**
	 * For `learns-no-ability` and `might-learn`: the jinxed partner they learn about; for
	 * `storyteller-has`, the jinxed partner that makes the Storyteller have the ability; for
	 * `guessed`, `not-shown-given`, `may-mad-as`, `reverts` and `partner-setup`, the jinxed
	 * partner the alert is about.
	 */
	partner?: CharacterId;
	/** For `storyteller-chooses` and `wakes-one-by-one`: the character type that carries it. */
	type?: CharacterType;
	/** For `wakes-one-by-one`: the players wake to choose who carries its `carrierIsDemon` token. */
	carrier?: true;
	/** For `missing-token`: the label of the reminder the player should carry. */
	token?: string;
	/** For `learns-alignment`: the alignment the player learns. */
	alignment?: Alignment;
	/** For `learns-character`: the partner's player whose true character they learn. */
	about?: SeatId;
}

/** The character's wiki page, when it has one. */
export function wikiOf(source: AbilitySource, characters: CharacterLookup): string | undefined {
	const character = characters.get(source.characterId);
	return character && wikiUrl(character);
}

/** An alert about `seatId` from `source`, which works unless its own player is impaired. */
export function sourceAlert(
	game: Game,
	kind: NightAlertKind,
	seatId: SeatId,
	source: AbilitySource,
	characters: CharacterLookup,
	wiki: string | undefined
): NightAlert {
	const impairments = source.seatId
		? abilityState(game, source.seatId, characters).impairments
		: [];
	const alert: NightAlert = { kind, seatId, source, works: impairments.length === 0, impairments };
	if (wiki) alert.wiki = wiki;
	return alert;
}

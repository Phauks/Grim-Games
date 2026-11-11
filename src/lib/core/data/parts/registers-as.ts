import { anyOf, byToken, oneOf, optObj, T, TOKEN, type SpecValue } from '../field-spec.ts';
import { ALIGNMENTS, CHARACTER_TYPES } from '../types.ts';
import { specPart, type PartValue } from './part.ts';

const REGISTERS = optObj({ alignments: anyOf(ALIGNMENTS), types: anyOf(CHARACTER_TYPES) });

/**
 * A `registersAs.tokens` entry. `asAnything`: the carrier may register as either alignment and
 * any seated character type, its true ones first; `whileToken`: only while another of this
 * character's reminders is still in play (the Revolutionary's pair, each "Aligned", may
 * register falsely until "Register Falsely?" comes off,
 * https://wiki.bloodontheclocktower.com/Revolutionary).
 */
const TOKEN_REGISTERS = optObj({
	alignments: anyOf(ALIGNMENTS),
	types: anyOf(CHARACTER_TYPES),
	carrierAlignment: oneOf(ALIGNMENTS),
	asAnything: T,
	whileToken: TOKEN
});

/** What a player may also register as, besides their true alignment and character type. */
export type Registers = SpecValue<typeof REGISTERS>;
export type TokenRegisters = SpecValue<typeof TOKEN_REGISTERS>;

/**
 * Who may register as something else while this character's ability works: `self`, its own
 * player, even if dead (the Spy as good and a Townsfolk or Outsider, the Recluse as evil and a
 * Minion or Demon); `tokens`, the player carrying one of its reminders, by label, only while
 * their alignment is `carrierAlignment` when given (the Lycanthrope's "Faux Paw" on a good
 * player, as evil; `TokenRegisters`). A Fabled's tokens work while it is in play.
 */
export const registersAs = specPart(
	'Registers as',
	'Players who may register as another alignment or character type.',
	optObj({ self: REGISTERS, tokens: byToken(TOKEN_REGISTERS) })
);

export type RegistersAs = PartValue<typeof registersAs>;

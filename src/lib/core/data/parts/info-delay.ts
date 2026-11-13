import { CHARACTERS, obj, opt } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * While a rule source with this part is in play, every character whose ability gives it
 * information (its rules have `answers` or `learns`) receives it one night later, worked out as
 * things stood when the ability was used; whether the player is drunk or poisoned counts when
 * they receive it. Characters in `except` are not delayed. Evil learning each other and the
 * Demon's bluffs are separate steps, so they never are. One Day More's Signal Failure
 * (https://beardytas.com/garden-of-djinn/one-day-more/; `rules/night/info/held-info.ts`).
 */
export const infoDelay = specPart(
	'night',
	'Information a night late',
	'While in play, characters that learn information receive it one night later (a day later for day information), as it was when their ability was used.',
	obj({ except: opt(CHARACTERS) })
);

export type InfoDelay = PartValue<typeof infoDelay>;

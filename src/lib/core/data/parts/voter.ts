import { COUNT, optObj, T, TOKEN } from '../field-spec.ts';
import { specPart, type PartValue } from './part.ts';

/**
 * How its own player votes, while the character's ability works:
 * - `onlyWith`: they may vote only when the player carrying this reminder votes too (the
 *   Butler's Master, https://wiki.bloodontheclocktower.com/Butler);
 * - `must`: they must vote on every nomination, while at least `minAlive` players live (the
 *   Zealot, https://wiki.bloodontheclocktower.com/Zealot);
 * - `needsToken`: they vote only by using a vote token, which dead players may give them
 *   (the Beggar, https://wiki.bloodontheclocktower.com/Beggar); with `learnsGiver`, the
 *   Storyteller privately tells them the alignment of each player who gives them one
 *   (`tokenGiverInfo` in `rules/day/vote-weights.ts`).
 */
export const voter = specPart(
	'day',
	'How its player votes',
	'Its player may vote only with another, must vote, or needs a vote token to vote.',
	optObj({ onlyWith: TOKEN, must: T, minAlive: COUNT, needsToken: T, learnsGiver: T }),
	(value, path, issues) => {
		const before = issues.list.length;
		if (value.learnsGiver && !value.needsToken) {
			issues.add(`${path}.learnsGiver`, 'only with needsToken');
		}
		if (value.minAlive !== undefined && !value.must)
			issues.add(`${path}.minAlive`, 'only with must');
		if (!value.onlyWith && !value.must && !value.needsToken) {
			issues.add(path, 'expected onlyWith, must or needsToken');
		}
		return issues.list.length > before ? undefined : value;
	}
);

export type Voter = PartValue<typeof voter>;

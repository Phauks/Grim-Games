import { GAME_MODE_FORMAT, type GameMode } from '../types.ts';

const RULES = 'https://fleshandbone.app/rules.php';

/**
 * Flesh and Bone (Living Scripts): a campaign of games with the Flesh and Bone Fabled in
 * play. After each game every character that died by execution is eliminated for the
 * campaign and replaced on the next script by an uneliminated character of the same type;
 * scripts aim for 13 Townsfolk, 4 Outsiders, 4 Minions and 4 Demons, adding one Demon per
 * game until there are 4. Campaigns end when no Demons remain, or on the chosen end
 * condition. Per-character exceptions are in the rules (https://fleshandbone.app/rules.php,
 * https://fleshandbone.app/). Trevor called it "Skull and Bones" (2026-10-17); no mode by
 * that name was found.
 *
 * Its Generic characters are homebrew with their own abilities, so they stay out: the
 * rules page is linked instead (no authored content).
 */
export const FLESH_AND_BONE: GameMode = {
	format: GAME_MODE_FORMAT,
	id: 'flesh-and-bone',
	name: 'Flesh and Bone',
	about:
		'A campaign of games with the Flesh and Bone Fabled. Characters executed in one game are out for the rest of the campaign and replaced on the next script.',
	aliases: ['Living Scripts', 'Skull and Bones'],
	sources: [
		{ title: 'Flesh & Bone rules', url: RULES },
		{ title: 'Flesh & Bone', url: 'https://fleshandbone.app/' }
	],
	// The rules page names no author; the Specters stream's description calls Nashable its creator.
	authors: [{ title: 'Nashable', url: 'https://www.youtube.com/watch?v=-R34QbIgDh8' }],
	parts: {
		pool: { kind: 'campaign', startingScript: 'any' },
		forced: {
			homebrew: [{ title: 'Flesh and Bone (Fabled)', url: 'https://fleshandbone.app/' }],
			instructions:
				'Put the Flesh and Bone Fabled in play. It is homebrew, so its ability is on its own page, not in the app.'
		},
		ruleChanges: [
			{
				characters: ['choirboy', 'huntsman'],
				cite: RULES,
				instructions:
					'The Choirboy and Huntsman work differently once the King or Damsel is out of the campaign. The rules page says how.'
			}
		],
		betweenGames: {
			kind: 'campaign',
			eliminate: 'every-executed',
			replaceSameType: true,
			target: { townsfolk: 13, outsider: 4, minion: 4, demon: 4 },
			growDemons: true,
			endConditions: ['no-demons']
		}
	}
};

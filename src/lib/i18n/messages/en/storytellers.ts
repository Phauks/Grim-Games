/**
 * Two Storytellers (a `twoStorytellers` rule character: the Knaves): which one each player goes
 * to, their names, who lies, and the switch (src/lib/features/grimoire, src/lib/features/savant).
 */
export const storytellers = {
	'storytellers.title': 'Storytellers',
	'storytellers.wentTo': 'Went to',
	'storytellers.wentToLabel': 'Which Storyteller {seat} went to',
	'storytellers.default': 'Storyteller {number}',
	'storytellers.lies': 'lies',
	'storytellers.name': 'Storyteller {number}, name',
	'storytellers.liar': 'Who lies',
	'storytellers.undecided': 'Not decided',
	'storytellers.switch': 'Switch',
	'storytellers.switched': 'They have switched; they usually switch once per game.',
	'storytellers.notSwitched': 'Once per game, at dusk, they may switch.',
	'storytellers.liarFalse': 'The lying Storyteller: the information must be false.',
	'storytellers.truthTrue': 'The truthful Storyteller: normal information.',
	'storytellers.savantLies': '{character}: the lying Storyteller, so both are false.',
	'storytellers.savantTruth': '{character}: the truthful Storyteller, so both may be true.'
} as const;

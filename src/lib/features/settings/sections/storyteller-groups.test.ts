import { describe, expect, it } from 'vitest';
import { STORYTELLER_HELP_KEYS } from '#lib/ui/assistance.ts';
import { STORYTELLER_GROUPS } from './storyteller-groups.ts';

describe('Storyteller settings groups', () => {
	it('list every Storyteller switch exactly once', () => {
		const grouped = Object.values(STORYTELLER_GROUPS).flat();
		expect([...grouped].sort()).toEqual([...STORYTELLER_HELP_KEYS].sort());
	});
});

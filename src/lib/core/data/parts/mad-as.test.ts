import { describe, expect, it } from 'vitest';
import { parseCharacterRules } from '../character-rules.ts';
import { Issues } from '../validate.ts';

describe('madAs', () => {
	const read = (raw: unknown) => {
		const issues = new Issues();
		const rules = parseCharacterRules({ madAs: raw }, 'x', issues, ['Mad']);
		return { value: rules?.madAs, issues: issues.list };
	};

	it('reads characters the carrier may also be mad as, whatever their type (M61c)', () => {
		expect(
			read({ token: 'Mad', mad: 'carrier', choose: ['townsfolk'], characters: ['goblin'] })
		).toEqual({
			value: { token: 'Mad', mad: 'carrier', choose: ['townsfolk'], characters: ['goblin'] },
			issues: []
		});
	});

	it('rejects characters on a madness about its own player', () => {
		const { issues } = read({ token: 'Mad', mad: 'self', characters: ['goblin'] });
		expect(issues).toEqual(['x.madAs.characters: only with mad "carrier"']);
	});
});

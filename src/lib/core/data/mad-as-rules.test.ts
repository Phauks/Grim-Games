import { describe, expect, it } from 'vitest';
import { readMadAs } from './mad-as-rules.ts';
import { Issues } from './validate.ts';

describe('readMadAs', () => {
	const read = (raw: unknown) => {
		const issues = new Issues();
		return { value: readMadAs(raw, 'madAs', issues, ['Mad']), issues: issues.list };
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
		expect(issues.join(' ')).toMatch(/madAs.characters: only with mad "carrier"/);
	});
});

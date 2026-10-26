import { describe, expect, it } from 'vitest';
import { GRIM_VIEW_PASSWORD_LENGTH, newGrimViewPassword } from './grim-view-password.ts';

describe("Grim view's password", () => {
	it('is six letters and digits that read aloud clearly', () => {
		const password = newGrimViewPassword();
		expect(password).toHaveLength(GRIM_VIEW_PASSWORD_LENGTH);
		expect(password).toMatch(/^[a-z2-9]+$/);
		expect(password).not.toMatch(/[ilo01]/);
	});

	it('is made from the random numbers it is given', () => {
		expect(newGrimViewPassword(() => 0)).toBe('aaaaaa');
		expect(newGrimViewPassword(() => 0.999)).toBe('999999');
	});

	it('is a different one each time', () => {
		const made = new Set(Array.from({ length: 20 }, () => newGrimViewPassword()));
		expect(made.size).toBeGreaterThan(15);
	});
});

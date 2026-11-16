import { describe, expect, it } from 'vitest';
import { besidePlacement } from './beside.ts';

describe('besidePlacement', () => {
	it('puts the pane on the right of a wide screen', () => {
		expect(besidePlacement(1440, 900, 16)).toBe('side');
		expect(besidePlacement(1138, 712, 16)).toBe('side');
	});
	it('puts it under the content on an upright tablet', () => {
		expect(besidePlacement(712, 1138, 16)).toBe('under');
	});
	it('has no room on a phone', () => {
		expect(besidePlacement(390, 844, 16)).toBeUndefined();
		expect(besidePlacement(0, 0, 16)).toBeUndefined();
	});
	it('follows the text size', () => {
		expect(besidePlacement(820, 1180, 16)).toBe('side');
		expect(besidePlacement(820, 1180, 20)).toBe('under');
	});
});

import { describe, expect, it } from 'vitest';
import { qrCentreBox } from './qr-centre.ts';

// Trevor, 2026-10-23: the logo's backing ends exactly on the QR code's module lines.
describe('the middle of a QR code', () => {
	it('covers whole modules, centred, within its share', () => {
		for (let version = 1; version <= 40; version++) {
			const modules = 17 + 4 * version;
			for (const [w, h] of [
				[0.3, 0.3],
				[0.48, 0.14]
			]) {
				const box = qrCentreBox(modules, w, h);
				for (const edge of [box.x, box.y, box.width, box.height]) {
					expect(Number.isInteger(edge)).toBe(true);
				}
				expect(box.x * 2 + box.width).toBe(modules);
				expect(box.y * 2 + box.height).toBe(modules);
				expect(box.width).toBeLessThanOrEqual(modules * w);
				expect(box.height).toBeLessThanOrEqual(modules * h);
				// As large as it can be: two more modules would pass the share.
				expect(box.width + 2).toBeGreaterThan(modules * w);
			}
		}
	});

	it('is 5 modules square on the smallest code with a 30% logo, 7 on the next', () => {
		expect(qrCentreBox(21, 0.3)).toEqual({ x: 8, y: 8, width: 5, height: 5 });
		expect(qrCentreBox(25, 0.3)).toEqual({ x: 9, y: 9, width: 7, height: 7 });
	});
});

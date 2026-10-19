import { describe, expect, it } from 'vitest';
import { duration, parseDuration } from './motion.ts';

describe('parseDuration', () => {
	it('reads milliseconds and seconds', () => {
		expect(parseDuration(' 240ms ')).toBe(240);
		expect(parseDuration('0.3s')).toBe(300);
	});
	it('is 0 for reduced motion or anything unreadable', () => {
		expect(parseDuration('0ms')).toBe(0);
		expect(parseDuration('')).toBe(0);
		expect(parseDuration('fast')).toBe(0);
		expect(parseDuration('-1s')).toBe(0);
	});
});

describe('duration', () => {
	it('is 0 when asked for no motion', () => {
		expect(duration('none')).toBe(0);
	});
});

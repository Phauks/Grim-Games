import { describe, expect, it } from 'vitest';
import { awayFromSeat, lineShown, parseReminderLines, type LineInput } from './reminder-lines.ts';

// A 100px token with 40px reminders: the first spot in front of it is 50 + 20 + 6 = 76px out.
const seat = { x: 0, y: 0 };
const near: LineInput = { seat, at: { x: 76, y: 0 }, size: 100, chip: 40, held: false };
const far: LineInput = { ...near, at: { x: 76 + 50, y: 0 } };

describe('reminder lines', () => {
	it('reads a stored choice, and anything else as always', () => {
		expect(parseReminderLines('away')).toBe('away');
		expect(parseReminderLines('never')).toBe('never');
		expect(parseReminderLines('sometimes')).toBe('always');
		expect(parseReminderLines(undefined)).toBe('always');
	});

	it('counts a reminder past the first spot in front of its seat as away', () => {
		expect(awayFromSeat(near)).toBe(false);
		// Half a reminder further out is still the first spot, nudged clear of a name.
		expect(awayFromSeat({ ...near, at: { x: 96, y: 0 } })).toBe(false);
		expect(awayFromSeat(far)).toBe(true);
	});

	it('shows each line by the choice', () => {
		expect(lineShown('always', near)).toBe(true);
		expect(lineShown('never', far)).toBe(false);
		expect(lineShown('away', near)).toBe(false);
		expect(lineShown('away', far)).toBe(true);
		expect(lineShown('held', far)).toBe(false);
		expect(lineShown('held', { ...near, held: true })).toBe(true);
	});
});

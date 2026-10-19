import { describe, expect, it } from 'vitest';
import { toGamePreview } from './room-preview.ts';

describe('the game a room code opens', () => {
	it('is nothing when no room is open', () => {
		expect(toGamePreview({ open: false })).toBeUndefined();
	});

	it('has no name before the Storyteller has sent the script', () => {
		expect(toGamePreview({ open: true })).toEqual({ name: '' });
	});

	it("shows an edition's own logo", () => {
		expect(
			toGamePreview({
				open: true,
				script: { name: 'Trouble Brewing', official: true },
				seats: 8,
				seated: 3
			})
		).toEqual({ name: 'Trouble Brewing', logo: '/data/logos/tb.webp', seats: 8, seated: 3 });
	});

	it("shows an author's https logo, and never another kind of link", () => {
		const script = { name: 'Storm Front', author: 'Kim', official: false };
		expect(
			toGamePreview({ open: true, script: { ...script, logo: 'https://logo.example/s.png' } })
		).toEqual({ name: 'Storm Front', author: 'Kim', logo: 'https://logo.example/s.png' });
		expect(
			toGamePreview({ open: true, script: { ...script, logo: 'javascript:alert(1)' } })?.logo
		).toBeUndefined();
	});

	it('takes no edition logo for a homebrew script named like an edition', () => {
		expect(
			toGamePreview({ open: true, script: { name: 'Trouble Brewing', official: false } })?.logo
		).toBeUndefined();
	});
});

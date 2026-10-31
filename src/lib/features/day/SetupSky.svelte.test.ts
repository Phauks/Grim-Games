import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Candle, CandleState } from '#lib/core/sync/seat-presence.ts';
import SetupSky from './SetupSky.svelte';

const candles = (...states: CandleState[]): Candle[] =>
	states.map((state, i) => ({ state, mine: i === 0, height: (i % 3) / 2 }));

// Sparks once every seat's candle is lit (Trevor, 2026-10-31).
describe('SetupSky candles', () => {
	it('sends sparks up from every flame once every seat is lit', () => {
		const screen = render(SetupSky, { look: 'candles', candles: candles('lit', 'lit', 'lit') });
		const sky = screen.getByTestId('players-setup-sky').element();
		expect(sky.hasAttribute('data-all-lit')).toBe(true);
		for (const candle of sky.querySelectorAll('.candle')) {
			expect(candle.querySelectorAll('.spark').length).toBe(3);
		}
	});

	it('has no sparks while a seat is away or empty', () => {
		for (const missing of ['away', 'empty'] as const) {
			const screen = render(SetupSky, { look: 'candles', candles: candles('lit', missing, 'lit') });
			const sky = screen.getByTestId('players-setup-sky').element();
			expect(sky.hasAttribute('data-all-lit')).toBe(false);
			expect(sky.querySelectorAll('.spark').length).toBe(0);
			screen.unmount();
		}
	});

	it('ignores phones with no seat, and has no sparks with no seats', () => {
		const seated = render(SetupSky, {
			look: 'candles',
			candles: candles('lit', 'lit'),
			unseated: 2
		});
		expect(seated.getByTestId('players-setup-sky').element().hasAttribute('data-all-lit')).toBe(
			true
		);
		seated.unmount();
		const none = render(SetupSky, { look: 'candles', candles: [] });
		expect(none.getByTestId('players-setup-sky').element().querySelectorAll('.spark').length).toBe(
			0
		);
	});
});

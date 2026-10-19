import { describe, expect, it } from 'vitest';
import { layerStyle, onLayerOpen, openLayer } from './layers.ts';

describe('overlay layers', () => {
	it('puts each newly opened overlay above every open one, in the order opened', () => {
		const first = openLayer();
		const second = openLayer();
		expect(second.layer).toBeGreaterThan(first.layer);
		// Closing the lower one doesn't let the next overlay land level with the upper one.
		first.close();
		const third = openLayer();
		expect(third.layer).toBeGreaterThan(second.layer);
		second.close();
		third.close();
	});

	it('starts again from the bottom once everything is closed', () => {
		const only = openLayer();
		expect(only.layer).toBe(1);
		only.close();
		expect(openLayer().layer).toBe(1);
	});

	it('tells listeners when an overlay opens, until they stop listening', () => {
		let calls = 0;
		const stop = onLayerOpen(() => calls++);
		openLayer().close();
		expect(calls).toBe(1);
		stop();
		openLayer().close();
		expect(calls).toBe(1);
	});

	it('draws a backdrop under its own content', () => {
		expect(layerStyle(1, 'backdrop')).toBe('--layer: 2');
		expect(layerStyle(1, 'content')).toBe('--layer: 3');
	});
});

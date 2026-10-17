import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TypeCounts from './TypeCounts.svelte';

describe('TypeCounts', () => {
	it('lists the types present in order, singular for one', async () => {
		const screen = render(TypeCounts, { counts: { demon: 1, townsfolk: 13, outsider: 4 } });
		const line = screen.getByTestId('type-counts').element();
		expect(line.textContent?.replace(/\s+/g, ' ').replace(/ ?· ?/g, ' · ').trim()).toBe(
			'13 Townsfolk · 4 Outsiders · 1 Demon'
		);
		expect(line.querySelector('[data-type="outsider"]')?.textContent).toBe('4');
		expect(line.querySelector('[data-type="minion"]')).toBeNull();
	});
});

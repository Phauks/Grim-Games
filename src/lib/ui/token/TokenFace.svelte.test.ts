import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import TokenFace from './TokenFace.svelte';

const leaves = { firstNight: false, otherNight: false, reminders: 0 };

/** The edge's length, and how long the name is drawn along it. */
function fitOf(token: Element) {
	const path = token.querySelector<SVGPathElement>('path[id^="name-"]')!;
	const onPath = token.querySelector<SVGTextPathElement>('textPath')!;
	const measure = token.querySelector<SVGTextElement>('text.measure')!;
	const squeezed = onPath.getAttribute('textLength');
	return {
		room: path.getTotalLength(),
		drawn: squeezed === null ? measure.getComputedTextLength() : Number(squeezed)
	};
}

// Trevor (2026-11-04): "boomdandy shows boomdand on token on board". The edge cut off a name
// whose letters ran wider than its letter count suggested.
describe('TokenFace name', () => {
	it('fits a name of wide letters on the edge, whole', async () => {
		const screen = render(TokenFace, { label: 'Wide', leaves, size: 120, name: 'WWWWWWWWW' });
		const token = screen.container.querySelector('[data-token-face]')!;
		await expect
			.poll(() => token.querySelector('textPath')?.getAttribute('textLength'))
			.not.toBe(null);
		const { room, drawn } = fitOf(token);
		expect(drawn).toBeLessThanOrEqual(room + 0.5);
	});

	it('leaves a short name at its own width', async () => {
		const screen = render(TokenFace, { label: 'Imp', leaves, size: 120, name: 'Imp' });
		const token = screen.container.querySelector('[data-token-face]')!;
		await expect.poll(() => fitOf(token).drawn).toBeGreaterThan(0);
		expect(token.querySelector('textPath')!.getAttribute('textLength')).toBe(null);
		const { room, drawn } = fitOf(token);
		expect(drawn).toBeLessThan(room);
	});

	it('fits long character names whole', async () => {
		for (const name of ['Boomdandy', 'Fortune Teller', 'Devil’s Advocate', 'Plague Doctor']) {
			const screen = render(TokenFace, { label: name, leaves, size: 120, name });
			const token = screen.container.querySelector('[data-token-face]')!;
			await expect.poll(() => fitOf(token).drawn).toBeGreaterThan(0);
			const { room, drawn } = fitOf(token);
			expect(drawn, name).toBeLessThanOrEqual(room + 0.5);
			screen.unmount();
		}
	});
});

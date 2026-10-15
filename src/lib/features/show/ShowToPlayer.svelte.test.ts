import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Character } from '#lib/core/data/index.ts';
import ShowToPlayer from './ShowToPlayer.svelte';

/** A character whose data is broken: reading its name throws while the view renders. */
function brokenCharacter(): Character {
	return new Proxy(
		{ id: 'broken', type: 'townsfolk', reminders: [], remindersGlobal: [] },
		{
			get(target, key) {
				if (key === 'name') throw new Error('broken character data');
				return Reflect.get(target, key);
			}
		}
	) as unknown as Character;
}

describe('ShowToPlayer', () => {
	it('stays full screen and opaque when its content crashes', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const screen = render(ShowToPlayer, {
			open: true,
			title: 'You are',
			characters: [{ character: brokenCharacter() }]
		});

		await expect.element(screen.getByTestId('show-failed')).toBeVisible();
		const dialog = screen.getByTestId('show-to-player').element() as HTMLDialogElement;
		expect(dialog.open).toBe(true);
		const box = dialog.getBoundingClientRect();
		expect(box.width).toBe(window.innerWidth);
		expect(box.height).toBe(window.innerHeight);
		// No transparency: the grimoire underneath must not show through.
		expect(getComputedStyle(dialog).backgroundColor).not.toMatch(/rgba\(.*, 0\)|transparent/);
		await expect.element(screen.getByRole('button', { name: 'Close' })).toBeVisible();
	});
});

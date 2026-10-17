import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import type { Character } from '#lib/core/data/index.ts';
import CharacterPicker from './CharacterPicker.svelte';

const character = (id: string, name: string, type: Character['type']) =>
	({
		id,
		name,
		type,
		ability: `${name}'s ability.`,
		reminders: [],
		remindersGlobal: []
	}) as unknown as Character;
const characters = [
	character('chef', 'Chef', 'townsfolk'),
	character('empath', 'Empath', 'townsfolk'),
	character('imp', 'Imp', 'demon')
];

describe('CharacterPicker', () => {
	// Trevor, 2026-10-17: a seat's character is cleared by choosing None in Change character.
	it('lists None first when it can be chosen, chosen when nothing is', async () => {
		const onNone = vi.fn();
		const screen = render(CharacterPicker, { characters, onSelect: () => {}, onNone });
		const none = screen.getByTestId('picker-none');
		await expect.element(none).toHaveTextContent('None');
		await expect.element(none).toHaveAttribute('aria-current', 'true');
		const rows = screen.container.querySelectorAll('button.row');
		expect(rows[0]).toBe(none.element());
		await none.click();
		expect(onNone).toHaveBeenCalledOnce();
	});

	it('has no None row unless asked, and None is not current once a character is chosen', async () => {
		const plain = render(CharacterPicker, { characters, onSelect: () => {} });
		expect(plain.container.querySelector('[data-testid="picker-none"]')).toBeNull();
		const chosen = render(CharacterPicker, {
			characters,
			selected: ['chef'],
			onSelect: () => {},
			onNone: () => {}
		});
		await expect.element(chosen.getByTestId('picker-none')).not.toHaveAttribute('aria-current');
	});
});

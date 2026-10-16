import { describe, expect, it } from 'vitest';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { iconUrl } from './icon-url.ts';

const data = committedGameData();
const get = (id: string) => data.byId.get(id)!;

describe('iconUrl (a reminder or token icon shows its player’s alignment)', () => {
	it('draws an evil Minion’s icon red', () => {
		expect(iconUrl(get('poisoner'))).toMatch(/poisoner_e\.webp$/);
	});
	it('draws a good character’s icon blue, and red once that player is evil', () => {
		expect(iconUrl(get('washerwoman'))).toMatch(/washerwoman_g\.webp$/);
		expect(iconUrl(get('washerwoman'), 'evil')).toMatch(/washerwoman_e\.webp$/);
	});
	it('draws a Minion whose player turned good blue', () => {
		expect(iconUrl(get('poisoner'), 'good')).toMatch(/poisoner_g\.webp$/);
	});
});

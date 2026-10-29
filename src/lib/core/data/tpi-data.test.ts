/**
 * Checks the TPI data committed in static/data/ (written by `npm run sync:data`). When a
 * sync PR changes the data, these tests show what changed: update the expected counts
 * after checking the change against TPI's release notes.
 */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultAlignment } from './character-type.ts';
import { checkScriptSchema, loadGameData } from './game-data.ts';
import { characterIcons } from './icons.ts';
import { findJinx, jinxesFor } from './jinxes.ts';
import { CHARACTER_TYPES, NIGHT_MARKERS, type CharacterType } from './types.ts';

const dataDir = new URL('../../../../static/data/', import.meta.url);
const readJson = (file: string): unknown =>
	JSON.parse(readFileSync(new URL(file, dataDir), 'utf8'));

const data = loadGameData({
	roles: readJson('roles.json'),
	jinxes: readJson('jinxes.json'),
	nightsheet: readJson('nightsheet.json')
});

describe('committed TPI data', () => {
	it('has the expected characters by type', () => {
		const counts = Object.fromEntries(CHARACTER_TYPES.map((type) => [type, 0]));
		for (const character of data.characters) counts[character.type]++;
		expect(counts).toEqual({
			townsfolk: 69,
			outsider: 23,
			minion: 27,
			demon: 19,
			traveller: 18,
			fabled: 14,
			loric: 11
		} satisfies Record<CharacterType, number>);
		expect(data.characters).toHaveLength(181);
	});

	it('maps TPI team to type for known characters', () => {
		expect(data.byId.get('washerwoman')?.type).toBe('townsfolk');
		expect(data.byId.get('drunk')?.type).toBe('outsider');
		expect(data.byId.get('baron')?.type).toBe('minion');
		expect(data.byId.get('imp')?.type).toBe('demon');
		expect(data.byId.get('scapegoat')?.type).toBe('traveller');
		expect(data.byId.get('spiritofivory')?.type).toBe('fabled');
		expect(data.byId.get('bigwig')?.type).toBe('loric');
		expect(defaultAlignment(data.byId.get('imp')!.type)).toBe('evil');
	});

	it('has 131 jinx pairs, all between real characters', () => {
		expect(data.jinxes.all).toHaveLength(131);
		for (const { characters } of data.jinxes.all) {
			for (const id of characters) expect(data.byId.has(id), id).toBe(true);
		}
		// https://wiki.bloodontheclocktower.com/Spy#Related_Jinxes
		expect(findJinx(data.jinxes, 'magician', 'spy')).toBeDefined();
		expect(jinxesFor(data.jinxes, 'spy').length).toBeGreaterThan(0);
	});

	it('has a night sheet whose steps are characters or night markers', () => {
		const markers: readonly string[] = NIGHT_MARKERS;
		for (const night of ['firstNight', 'otherNight'] as const) {
			for (const id of data.nightSheet[night]) {
				expect(markers.includes(id) || data.byId.has(id), `${night}: ${id}`).toBe(true);
			}
			expect(data.nightSheet[night][0]).toBe('dusk');
			expect(data.nightSheet[night]).toContain('dawn');
		}
		// TPI puts a few steps after dawn: their text is an announcement to the group.
		const afterDawn = (list: string[]) => list.slice(list.indexOf('dawn') + 1);
		expect(afterDawn(data.nightSheet.firstNight)).toEqual(['leviathan', 'vizier']);
		expect(afterDawn(data.nightSheet.otherNight)).toEqual(['leviathan']);
		expect(data.nightSheet.firstNight).toContain('minioninfo');
		expect(data.nightSheet.firstNight).toContain('demoninfo');
		expect(data.nightSheet.otherNight).not.toContain('minioninfo');
	});

	it('lists a character on a night exactly when it has text for that night', () => {
		const first = new Set(data.nightSheet.firstNight);
		const other = new Set(data.nightSheet.otherNight);
		for (const c of data.characters) {
			expect(first.has(c.id), `${c.id} first night`).toBe(c.firstNightReminder !== undefined);
			expect(other.has(c.id), `${c.id} other nights`).toBe(c.otherNightReminder !== undefined);
		}
	});

	it('uses the script vocabulary our types encode', () => {
		expect(() => checkScriptSchema(readJson('script-schema.json'))).not.toThrow();
	});

	it('has the icons every character needs', () => {
		for (const character of data.characters) {
			const icons = characterIcons(character);
			expect(icons, character.id).toBeDefined();
			for (const file of Object.values(icons!)) {
				expect(existsSync(new URL(`icons/${file}`, dataDir)), file).toBe(true);
			}
		}
	});

	it('has a manifest that matches the files', () => {
		const manifest = readJson('manifest.json') as {
			source: { repository: string; commit: string };
			summary: { characters: number; jinxes: number };
			files: Record<string, { sha256: string }>;
		};
		expect(manifest.source.repository).toBe('ThePandemoniumInstitute/botc-release');
		expect(manifest.source.commit).toMatch(/^[0-9a-f]{40}$/);
		expect(manifest.summary.characters).toBe(data.characters.length);
		expect(manifest.summary.jinxes).toBe(data.jinxes.all.length);
		for (const file of ['roles.json', 'jinxes.json', 'nightsheet.json', 'script-schema.json']) {
			expect(manifest.files[file], file).toBeDefined();
		}
	});
});

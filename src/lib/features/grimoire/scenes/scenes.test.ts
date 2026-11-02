import { describe, expect, it } from 'vitest';
import { parseBackground, PRESETS, sceneOf, type PresetId } from '../backgrounds.ts';
import { drawnLook, lookOf } from '../shared-look.ts';
import { DEFAULT_BOARD_LOOKS } from '../board-looks.svelte.ts';
import { CSS_SCENES } from './css-scenes.ts';
import { SCENE_PRESETS } from './scene-presets.ts';
import { SHADERS } from './shaders.ts';

const ids = Object.keys(PRESETS) as PresetId[];
const ofKind = (kind: string) => ids.filter((id) => sceneOf(id) === kind).sort();

describe('moving backgrounds (L113)', () => {
	it('has twelve scenes, each a preset with a label and a still frame', () => {
		const scenes = ids.filter((id) => sceneOf(id));
		expect(scenes.sort()).toEqual(Object.keys(SCENE_PRESETS).sort());
		expect(scenes).toHaveLength(12);
		for (const id of scenes) {
			expect(PRESETS[id].label.trim(), id).not.toBe('');
			expect(PRESETS[id].css, id).toMatch(/gradient\(/);
		}
		// The still backgrounds stay still.
		expect(sceneOf('wood')).toBeUndefined();
	});

	it('has a drawing for every scene, by the kind its preset names', () => {
		expect(Object.keys(SHADERS).sort()).toEqual(ofKind('shader'));
		expect(Object.keys(CSS_SCENES).sort()).toEqual(ofKind('css'));
		expect(ofKind('shader')).toHaveLength(6);
		expect(ofKind('css')).toHaveLength(6);
		for (const [id, source] of Object.entries(SHADERS)) {
			expect(source, id).toContain('void main()');
			expect(source, id).toContain('gl_FragColor');
		}
	});

	it('saves, reads back and shares a scene as an ordinary preset', () => {
		expect(parseBackground({ kind: 'preset', id: 'hellfire' })).toEqual({
			kind: 'preset',
			id: 'hellfire'
		});
		expect(parseBackground({ kind: 'preset', id: 'beach' })).toEqual({
			kind: 'preset',
			id: 'beach'
		});
		expect(parseBackground({ kind: 'preset', id: 'volcano' })).toBeUndefined();
		const look = lookOf({ kind: 'preset', id: 'beach' }, DEFAULT_BOARD_LOOKS);
		expect(drawnLook(look).preset).toBe('beach');
	});
});

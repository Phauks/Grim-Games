import { describe, expect, it } from 'vitest';
import {
	addPoint,
	commitStroke,
	emptyPad,
	isBlank,
	migratePad,
	parseSizes,
	redo,
	sizeWidth,
	strokeWidth,
	undo,
	type ScratchStroke
} from '#lib/core/scratch/scratch.ts';

const pen = (points: number[] = [0.1, 0.1, 0.5]): ScratchStroke => ({
	tool: 'pen',
	colour: 'ink',
	size: 0.008,
	points
});

describe('addPoint', () => {
	it('drops points too close to the previous one', () => {
		const points: number[] = [];
		expect(addPoint(points, 0.5, 0.5, 0.5)).toBe(true);
		expect(addPoint(points, 0.5001, 0.5, 0.5)).toBe(false);
		expect(addPoint(points, 0.51, 0.5, 0.5)).toBe(true);
		expect(points).toHaveLength(6);
	});

	it('keeps points on the pad and rounds them', () => {
		const points: number[] = [];
		addPoint(points, -1, 9, 2);
		expect(points).toEqual([0, 1.3333, 1]);
		addPoint(points, 0.123456789, 0.5, 0.5);
		expect(points[3]).toBe(0.1235);
	});
});

describe('strokeWidth', () => {
	it('thickens with pressure for the pen only', () => {
		const light = strokeWidth({ tool: 'pen', size: 0.008 }, 0.1);
		const firm = strokeWidth({ tool: 'pen', size: 0.008 }, 0.9);
		expect(firm).toBeGreaterThan(light);
		expect(strokeWidth({ tool: 'eraser', size: 0.05 }, 0.1)).toBe(
			strokeWidth({ tool: 'eraser', size: 0.05 }, 0.9)
		);
	});
});

describe('sizeWidth', () => {
	it('grows with the step and stays within the slider', () => {
		expect(sizeWidth('pen', 4)).toBe(0.008);
		expect(sizeWidth('pen', 8)).toBeGreaterThan(sizeWidth('pen', 4));
		expect(sizeWidth('eraser', 0)).toBe(sizeWidth('eraser', 1));
		expect(sizeWidth('eraser', 99)).toBe(sizeWidth('eraser', 20));
	});

	it('scales the stroke width', () => {
		const thin = strokeWidth({ tool: 'pen', size: sizeWidth('pen', 2) }, 0.5);
		const thick = strokeWidth({ tool: 'pen', size: sizeWidth('pen', 12) }, 0.5);
		expect(thick).toBeCloseTo(thin * 6);
	});
});

describe('parseSizes', () => {
	it('keeps valid steps and defaults the rest', () => {
		expect(parseSizes({ pen: 9, eraser: 'big' })).toEqual({ pen: 9, eraser: 7 });
		expect(parseSizes({ pen: 50, eraser: 2.6 })).toEqual({ pen: 20, eraser: 3 });
		expect(parseSizes(null)).toEqual({ pen: 4, eraser: 7 });
	});
});

describe('history', () => {
	it('undoes and redoes strokes in order', () => {
		const a = pen([0.1, 0.1, 0.5]);
		const b = pen([0.2, 0.2, 0.5]);
		let h = commitStroke(commitStroke({ strokes: [], undone: [] }, a), b);
		h = undo(h);
		expect(h.strokes).toEqual([a]);
		expect(h.undone).toEqual([b]);
		h = redo(h);
		expect(h.strokes).toEqual([a, b]);
		expect(h.undone).toEqual([]);
	});

	it('a new stroke clears what could be redone', () => {
		const h = undo(commitStroke({ strokes: [], undone: [] }, pen()));
		expect(commitStroke(h, pen([0.3, 0.3, 0.5])).undone).toEqual([]);
	});

	it('ignores empty strokes and undo or redo with nothing to do', () => {
		const h = { strokes: [], undone: [] };
		expect(commitStroke(h, pen([]))).toBe(h);
		expect(undo(h)).toBe(h);
		expect(redo(h)).toBe(h);
	});
});

describe('isBlank', () => {
	it('counts only pen strokes as drawing', () => {
		expect(isBlank([])).toBe(true);
		expect(isBlank([{ ...pen(), tool: 'eraser' }])).toBe(true);
		expect(isBlank([pen()])).toBe(false);
	});
});

describe('migratePad', () => {
	it('reads a saved pad and drops unreadable strokes', () => {
		const saved = { schemaVersion: 2, strokes: [pen(), { tool: 'laser' }, pen([1, 2])] };
		expect(migratePad(saved)?.strokes).toEqual([pen()]);
	});

	it('gives v1 strokes the width v1 drew them at', () => {
		const v1 = {
			schemaVersion: 1,
			strokes: [
				{ tool: 'pen', colour: 'ink', points: [0.1, 0.1, 0.5] },
				{ tool: 'eraser', colour: 'ink', points: [0.2, 0.2, 0.5] }
			]
		};
		expect(migratePad(v1)?.strokes.map((s) => s.size)).toEqual([0.008, 0.05]);
		expect(migratePad(v1)?.schemaVersion).toBe(2);
	});

	it('rejects anything that is not a pad', () => {
		expect(migratePad(undefined)).toBeUndefined();
		expect(migratePad({ schemaVersion: 99, strokes: [] })).toBeUndefined();
		expect(migratePad(emptyPad())).toEqual(emptyPad());
	});
});

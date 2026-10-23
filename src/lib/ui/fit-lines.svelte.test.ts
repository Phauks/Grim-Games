import { afterEach, describe, expect, it } from 'vitest';
import { fitLines } from './fit-lines.ts';

describe('fitLines', () => {
	afterEach(() => document.body.replaceChildren());

	function box(text: string, maxWidth: string) {
		const node = document.createElement('span');
		node.textContent = text;
		Object.assign(node.style, {
			position: 'absolute',
			width: 'max-content',
			maxWidth,
			boxSizing: 'border-box',
			padding: '0 4px',
			font: '16px monospace',
			whiteSpace: 'normal'
		});
		document.body.append(node);
		return node;
	}

	it('shrinks wrapped words to their widest line', () => {
		// Wraps as "Minions not" and "nominated" in a 12em box, which stays 12em wide by itself.
		const node = box('Minions not nominated', '12em');
		expect(node.offsetWidth).toBe(192);
		const twoLines = node.offsetHeight;
		const done = fitLines()(node);
		// "Minions not" is 11 monospace characters, about 106px, plus the padding.
		expect(node.offsetWidth).toBeGreaterThan(100);
		expect(node.offsetWidth).toBeLessThan(130);
		// Still the same two lines.
		expect(node.offsetHeight).toBe(twoLines);
		done?.();
		expect(node.style.width).toBe('');
	});

	it('leaves one line alone', () => {
		const node = box('Drunk', '12em');
		const before = node.offsetWidth;
		fitLines()(node);
		expect(node.offsetWidth).toBe(before);
		expect(node.style.width).toBe('');
	});
});

import { describe, expect, it } from 'vitest';
import { SHADERS } from './shaders.ts';
import { shaderRenderer } from './webgl.ts';

// In a real browser, so every scene's shader is built by a real GPU driver (moving
// backgrounds, L113). Runs in the browser project for its WebGL.
describe('shader scenes', () => {
	for (const [id, source] of Object.entries(SHADERS)) {
		it(`builds and draws ${id}`, () => {
			const canvas = document.createElement('canvas');
			canvas.style.width = '20rem';
			canvas.style.height = '10rem';
			document.body.append(canvas);
			const renderer = shaderRenderer(canvas, source);
			expect(renderer).toBeDefined();
			renderer!.draw(4);
			// Half the size it shows at.
			expect(canvas.width).toBe(Math.round(canvas.clientWidth / 2));
			renderer!.dispose();
			canvas.remove();
		});
	}
	it('gives up on a shader that does not build', () => {
		const canvas = document.createElement('canvas');
		expect(shaderRenderer(canvas, 'not a shader')).toBeUndefined();
	});
});

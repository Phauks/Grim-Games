<script lang="ts">
	import { SHADERS, type ShaderSceneId } from './shaders.ts';
	/**
	 * SPIKE (animated backgrounds, not for merge). Option B: a WebGL fragment shader draws the
	 * scene every frame. Drawn at half resolution and capped at 30 frames a second; stops while
	 * the page is hidden; draws one frame and stops when still.
	 */
	interface Props {
		scene: ShaderSceneId;
		still?: boolean;
		contained?: boolean;
	}
	let { scene, still = false, contained = false }: Props = $props();
	let canvas = $state<HTMLCanvasElement>();

	const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
	$effect(() => {
		if (!canvas) return;
		const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
		if (!gl) return;
		const compile = (type: number, src: string) => {
			const s = gl.createShader(type)!;
			gl.shaderSource(s, src);
			gl.compileShader(s);
			if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
				console.error('shader', scene, gl.getShaderInfoLog(s));
			return s;
		};
		const prog = gl.createProgram()!;
		gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
		gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, SHADERS[scene].frag));
		gl.linkProgram(prog);
		gl.useProgram(prog);
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, buf);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const loc = gl.getAttribLocation(prog, 'p');
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
		const res = gl.getUniformLocation(prog, 'res');
		const time = gl.getUniformLocation(prog, 't');

		const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
		let frame = 0;
		let last = 0;
		const draw = (now: number) => {
			const c = canvas!;
			// Half resolution: the dimmed, soft scene needs no more, and it quarters the work.
			const w = Math.max(1, Math.round(c.clientWidth / 2));
			const hgt = Math.max(1, Math.round(c.clientHeight / 2));
			if (c.width !== w || c.height !== hgt) {
				c.width = w;
				c.height = hgt;
				gl.viewport(0, 0, w, hgt);
			}
			gl.uniform2f(res, w, hgt);
			gl.uniform1f(time, still || reduce ? 4 : now / 1000);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		};
		const loop = (now: number) => {
			frame = requestAnimationFrame(loop);
			if (now - last < 1000 / 30) return;
			last = now;
			draw(now);
		};
		if (still || reduce) draw(0);
		else frame = requestAnimationFrame(loop);
		const onVisible = () => {
			cancelAnimationFrame(frame);
			if (document.visibilityState === 'visible' && !still && !reduce)
				frame = requestAnimationFrame(loop);
		};
		document.addEventListener('visibilitychange', onVisible);
		return () => {
			cancelAnimationFrame(frame);
			document.removeEventListener('visibilitychange', onVisible);
		};
	});
</script>

<canvas bind:this={canvas} class="scene" class:contained aria-hidden="true"></canvas>

<style>
	.scene {
		position: fixed;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: -1;
		pointer-events: none;
		filter: brightness(0.6) saturate(0.95);
	}
	.contained {
		position: absolute;
	}
</style>

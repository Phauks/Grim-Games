/**
 * Draws one fragment shader over a whole canvas (moving backgrounds, plan L113). Undefined
 * when the device has no WebGL or the shader does not build, so the preset's still frame
 * shows instead.
 */
export interface ShaderRenderer {
	/** Draws the frame at `seconds`, first matching the canvas to its size on screen. */
	draw(seconds: number): void;
	dispose(): void;
}

const VERTEX = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }`;
/**
 * The drawing is this share of the canvas's size on screen: the dimmed, soft scene needs no
 * more, and half each way is a quarter of the work.
 */
const SCALE = 0.5;

export function shaderRenderer(
	canvas: HTMLCanvasElement,
	fragment: string
): ShaderRenderer | undefined {
	const gl = canvas.getContext('webgl', {
		antialias: false,
		alpha: false,
		depth: false,
		powerPreference: 'low-power'
	});
	if (!gl) return undefined;
	const lose = () => gl.getExtension('WEBGL_lose_context')?.loseContext();
	const compile = (type: number, source: string) => {
		const shader = gl.createShader(type);
		if (!shader) return undefined;
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : undefined;
	};
	const vertex = compile(gl.VERTEX_SHADER, VERTEX);
	const frag = compile(gl.FRAGMENT_SHADER, fragment);
	const program = gl.createProgram();
	if (!vertex || !frag || !program) {
		lose();
		return undefined;
	}
	gl.attachShader(program, vertex);
	gl.attachShader(program, frag);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		lose();
		return undefined;
	}
	gl.useProgram(program);
	// One triangle that covers the whole canvas.
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const position = gl.getAttribLocation(program, 'p');
	gl.enableVertexAttribArray(position);
	gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
	const size = gl.getUniformLocation(program, 'res');
	const time = gl.getUniformLocation(program, 't');

	return {
		draw(seconds) {
			const width = Math.max(1, Math.round(canvas.clientWidth * SCALE));
			const height = Math.max(1, Math.round(canvas.clientHeight * SCALE));
			if (canvas.width !== width || canvas.height !== height) {
				canvas.width = width;
				canvas.height = height;
				gl.viewport(0, 0, width, height);
			}
			gl.uniform2f(size, width, height);
			gl.uniform1f(time, seconds);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		},
		dispose: lose
	};
}

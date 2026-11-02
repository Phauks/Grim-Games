<script lang="ts">
	/**
	 * SPIKE (animated backgrounds, not for merge). Option B: a WebGL fragment shader draws the
	 * scene every frame. Drawn at half resolution and capped at 30 frames a second; stops while
	 * the page is hidden; draws one frame and stops when still.
	 */
	interface Props {
		scene: 'hellfire' | 'beach';
		still?: boolean;
		contained?: boolean;
	}
	let { scene, still = false, contained = false }: Props = $props();
	let canvas = $state<HTMLCanvasElement>();

	const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;
	const COMMON = `
precision mediump float;
uniform vec2 res; uniform float t;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*n(p); p*=2.03; a*=.5; } return v; }
`;
	const FRAG: Record<Props['scene'], string> = {
		hellfire: `${COMMON}
void main(){
  vec2 uv = gl_FragCoord.xy/res; float asp = res.x/res.y;
  vec2 q = vec2(uv.x*asp*3., uv.y*2.5 - t*1.1);
  float f = fbm(q + fbm(q*1.7 + t*.3));
  float flame = clamp(f*1.6 - uv.y*1.35, 0., 1.);
  flame = pow(flame, 1.4);
  vec3 c = mix(vec3(.05,.01,.01), vec3(.25,.03,.02), uv.y < .5 ? 1.-uv.y*2. : 0.);
  c += vec3(1.0,.35,.05)*flame*1.6 + vec3(1.,.85,.4)*pow(flame,3.)*1.4;
  vec2 eg = vec2(uv.x*asp*40., uv.y*40. - t*5.);
  float ember = step(.97, h(floor(eg))) * smoothstep(.18,.0, length(fract(eg)-.5));
  c += vec3(1.,.6,.2)*ember*(1.-uv.y)*1.2;
  gl_FragColor = vec4(c,1.);
}`,
		beach: `${COMMON}
void main(){
  vec2 uv = gl_FragCoord.xy/res; float asp = res.x/res.y;
  vec3 sky = mix(vec3(.95,.8,.55), vec3(.25,.5,.75), smoothstep(.55,1.,uv.y));
  float sun = smoothstep(.065,.055, length((uv-vec2(.62,.74))*vec2(asp,1.)));
  sky += vec3(1.,.95,.75)*sun;
  vec2 w = vec2(uv.x*asp*6., uv.y*40.);
  float ripple = fbm(w + vec2(t*.4, 0.)) * fbm(w*1.3 - vec2(t*.3, 0.));
  vec3 sea = mix(vec3(.15,.55,.6), vec3(.2,.45,.7), uv.y*2.) + vec3(1.)*smoothstep(.32,.45,ripple)*.6;
  float shore = .3 + .025*sin(uv.x*asp*9. + t*.9) + .02*sin(t*.6);
  float foam = smoothstep(.02,.0, abs(uv.y - shore)) * .9;
  vec3 sand = mix(vec3(.75,.62,.42), vec3(.9,.8,.6), uv.y/.3);
  vec3 c = uv.y > .55 ? sky : (uv.y > shore ? sea : sand);
  c = mix(c, vec3(1.), foam);
  gl_FragColor = vec4(c,1.);
}`
	};

	$effect(() => {
		if (!canvas) return;
		const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
		if (!gl) return;
		const compile = (type: number, src: string) => {
			const s = gl.createShader(type)!;
			gl.shaderSource(s, src);
			gl.compileShader(s);
			return s;
		};
		const prog = gl.createProgram()!;
		gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
		gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG[scene]));
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

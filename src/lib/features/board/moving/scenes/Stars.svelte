<script lang="ts">
	// Stars: a night sky turning slowly about a pole above the screen. Star sizes follow a
	// steep power law (many faint, a few bright), colours run from blue-white to orange and
	// each swells at its own rate. A band of light with dark dust lanes, and now and then a
	// shooting star.
	import { T, useTask, useThrelte } from '@threlte/core';
	import { AdditiveBlending, Color, ShaderMaterial, Vector2, Vector4 } from 'three';
	import type { MovingParams } from '#lib/core/backgrounds/moving.ts';
	import FullscreenShader from '../gl/FullscreenShader.svelte';
	import { useClock } from '../gl/clock.ts';
	import { NOISE } from '../gl/noise.ts';
	import { hex, num } from '../gl/params.ts';
	import { seededPoints } from '../gl/points.ts';
	import { SPARKLE } from '../gl/sparkle.ts';

	let { params }: { params: MovingParams } = $props();
	const clock = useClock();
	const { renderer, size } = useThrelte();

	const u = {
		uTime: { value: 0 },
		uBandStrength: { value: 1 },
		uSpin: { value: 0 },
		uTop: { value: new Color() },
		uBottom: { value: new Color() },
		uBand: { value: new Color() },
		uGlow: { value: new Color() },
		uMeteor: { value: new Vector4(0, 0, 0, 0) },
		uMeteorK: { value: -1 }
	};
	const fragment = /* glsl */ `
    uniform vec2 uRes; uniform float uTime, uBandStrength, uSpin, uMeteorK;
    uniform vec3 uTop, uBottom, uBand, uGlow; uniform vec4 uMeteor;
    ${NOISE}
    void main(){
      vec2 uv = gl_FragCoord.xy/uRes;
      float m = min(uRes.x, uRes.y);
      vec2 p = (gl_FragCoord.xy - .5*uRes)/m;
      vec3 col = mix(uBottom, uTop, smoothstep(-.1, 1.1, uv.y));
      // The band stays put and its clouds drift slowly along it, so it never turns away.
      vec2 bq = mat2(.82, -.57, .57, .82)*p + vec2(uSpin*.6, 0.);
      float across = bq.y + (fbm(vec3(bq*1.2, 1.), 3) - .5)*.35;
      float band = exp(-across*across*16.);
      float cloud = fbm(vec3(bq*vec2(2.2, 4.), 2.), 6);
      float dust = smoothstep(.45, .75, fbm(vec3(bq*vec2(3.5, 7.), 5.), 5));
      float glow = band*(.35 + 1.1*cloud)*(1. - .8*dust*band);
      col += uBand*glow*.4*uBandStrength;
      col += uGlow*pow(band, 3.)*smoothstep(.55, .8, cloud)*.35*uBandStrength;
      // Shooting star: a short streak that fades along its tail.
      if (uMeteorK >= 0.) {
        vec2 s = uMeteor.xy, d = vec2(cos(uMeteor.z), sin(uMeteor.z));
        vec2 head = s + d*uMeteorK*.9;
        vec2 r = p - head;
        float along = -dot(r, d), off = dot(r, vec2(-d.y, d.x));
        float tail = .22*smoothstep(0., .25, uMeteorK);
        float streak = smoothstep(tail, 0., along)*step(0., along)*smoothstep(.003, .0, abs(off));
        float fade = smoothstep(1., .7, uMeteorK);
        col += vec3(1., .95, .85)*(streak*1.6 + exp(-length(r)*140.)*1.2)*fade;
      }
      gl_FragColor = vec4(col, 1.);
    }`;

	const su = {
		uReach: { value: 3 },
		uTime: { value: 0 },
		uRes: { value: new Vector2(1, 1) },
		uSpin: { value: 0 },
		uTint: { value: new Color() },
		uTwinkle: { value: 1 }
	};
	const starMaterial = new ShaderMaterial({
		uniforms: su,
		transparent: true,
		depthTest: false,
		depthWrite: false,
		blending: AdditiveBlending,
		vertexShader: /* glsl */ `
      attribute vec4 seed; uniform float uTime, uSpin, uReach, uTwinkle; uniform vec2 uRes;
      varying vec3 vCol; varying float vA, vGlint;
      vec3 temp(float k){
        // Blue-white through white and yellow to orange.
        vec3 c = mix(vec3(.65, .75, 1.), vec3(1.), smoothstep(0., .45, k));
        c = mix(c, vec3(1., .88, .65), smoothstep(.55, .85, k));
        return mix(c, vec3(1., .65, .45), smoothstep(.9, 1., k));
      }
      void main(){
        float m = min(uRes.x, uRes.y);
        // Stars fill a disc round the pole that reaches past every corner of the screen,
        // so however far the sky turns, the screen stays full.
        vec2 pole = vec2(0., .8);
        float ang = seed.x*6.2831853 + uSpin;
        float rad = sqrt(seed.y)*uReach;
        vec2 p = pole + vec2(cos(ang), sin(ang))*rad;
        gl_Position = vec4(p*m/uRes*2., 0., 1.);
        float mag = pow(seed.z, 9.);
        // Twinkle is a slow swell (under one cycle a second); 0 means perfectly steady.
        float tw = 1. - uTwinkle*.7*(.5 + .5*sin(uTime*(.6 + seed.w*2.4) + seed.z*90.));
        vA = (.25 + .75*smoothstep(0., .25, mag + .05))*tw;
        vCol = temp(fract(seed.w*7.13));
        vGlint = smoothstep(.35, .9, mag);
        gl_PointSize = max((5. + mag*24.)*m/1000., 4.);
      }`,
		fragmentShader: /* glsl */ `
      uniform vec3 uTint; varying vec3 vCol; varying float vA, vGlint;
      ${SPARKLE}
      void main(){
        float a = sparkle(gl_PointCoord, vGlint)*vA;
        gl_FragColor = vec4(vCol*uTint*a*1.3, a);
      }`
	});

	// The disc is bigger than the screen, so it holds more stars than are seen at once:
	// the count is scaled so "Stars" means stars on screen.
	const POLE_Y = 0.8;
	const reach = $derived.by(() => {
		const { width, height } = $size;
		const m = Math.min(width, height) || 1;
		const hx = width / m / 2;
		const hy = height / m / 2;
		return Math.max(Math.hypot(hx, hy - POLE_Y), Math.hypot(hx, -hy - POLE_Y)) + 0.05;
	});
	const geometry = $derived.by(() => {
		const { width, height } = $size;
		const m = Math.min(width, height) || 1;
		const screen = (width / m) * (height / m);
		const wanted = (num(params, 'count') * Math.PI * reach * reach) / screen;
		return seededPoints(Math.round(Math.min(wanted, 120000)), 4);
	});

	// Shooting stars: the first waits, so a sky held still never stops on one.
	let last = clock.t;
	let meteorStart = -1;
	let meteorLen = 1;
	let nextMeteor = clock.t + 3;
	useTask(
		() => {
			const t = clock.t;
			if (t < last) {
				// The clock wrapped round.
				meteorStart = -1;
				nextMeteor = t + 3;
			}
			last = t;
			const rate = num(params, 'meteors') / 60;
			if (rate && t > nextMeteor && meteorStart < 0) {
				meteorStart = t;
				meteorLen = 0.6 + Math.random() * 0.6;
				const angle =
					Math.random() < 0.5
						? -0.5 - Math.random() * 0.5
						: Math.PI + 0.35 + Math.random() * 0.45 * (Math.random() < 0.5 ? 1 : -1);
				u.uMeteor.value.set(-0.6 + Math.random() * 1.2, Math.random() * 0.45, angle, 0);
				nextMeteor = t + Math.max(2, (0.5 + Math.random()) / rate);
			}
			if (!rate) nextMeteor = Math.max(nextMeteor, t + 2);
			const k = meteorStart < 0 ? -1 : (t - meteorStart) / meteorLen;
			if (k > 1) meteorStart = -1;
			u.uMeteorK.value = k > 1 ? -1 : k;
			u.uSpin.value = su.uSpin.value = t * num(params, 'drift') * 0.004;
			u.uTime.value = su.uTime.value = t;
			u.uBandStrength.value = num(params, 'bandStrength');
			su.uTwinkle.value = num(params, 'twinkle');
			su.uReach.value = reach;
			u.uTop.value.set(hex(params, 'skyTop'));
			u.uBottom.value.set(hex(params, 'skyBottom'));
			u.uBand.value.set(hex(params, 'band'));
			u.uGlow.value.set(hex(params, 'bandGlow'));
			su.uTint.value.set(hex(params, 'tint'));
			renderer.getDrawingBufferSize(su.uRes.value);
		},
		{ autoInvalidate: false }
	);
	$effect(() => () => starMaterial.dispose());
</script>

<T.OrthographicCamera makeDefault position={[0, 0, 5]} />
<FullscreenShader {fragment} uniforms={u} />
<T.Points frustumCulled={false} renderOrder={1}>
	<T is={geometry} dispose />
	<T is={starMaterial} />
</T.Points>

<script lang="ts">
	// Rain: a stormy sky with drifting cloud, rain in depth (far drops fine, slow and faint,
	// near drops long, fast and bright), gusts that change the slant over time, splashes at
	// the bottom, mist and lightning that lights the clouds from inside.
	import { T, useTask, useThrelte } from '@threlte/core';
	import {
		AdditiveBlending,
		BufferAttribute,
		BufferGeometry,
		Color,
		ShaderMaterial,
		Vector2
	} from 'three';
	import type { MovingParams } from '#lib/core/backgrounds/moving.ts';
	import FullscreenShader from '../gl/FullscreenShader.svelte';
	import { useClock } from '../gl/clock.ts';
	import { NOISE } from '../gl/noise.ts';
	import { hex, num, on } from '../gl/params.ts';
	import { seededPoints } from '../gl/points.ts';

	let { params }: { params: MovingParams } = $props();
	const clock = useClock();
	const { renderer } = useThrelte();

	const u = {
		uTime: { value: 0 },
		uFlash: { value: 0 },
		uBolt: { value: 0 },
		uBoltX: { value: 0.5 },
		uBoltSeed: { value: 0 },
		uMist: { value: 0.5 },
		uWind: { value: 0 },
		uTop: { value: new Color() },
		uBottom: { value: new Color() },
		uRain: { value: new Color() },
		uLight: { value: new Color() }
	};
	const fragment = /* glsl */ `
    uniform vec2 uRes; uniform float uTime, uFlash, uBolt, uBoltX, uBoltSeed, uMist, uWind;
    uniform vec3 uTop, uBottom, uRain, uLight;
    ${NOISE}
    float boltX(float y){
      float x = uBoltX;
      x += snoise(vec3(y*3., uBoltSeed, 0.))*.06;
      x += snoise(vec3(y*11., uBoltSeed, 4.))*.025;
      x += snoise(vec3(y*37., uBoltSeed, 9.))*.008;
      return x;
    }
    void main(){
      vec2 uv = gl_FragCoord.xy/uRes;
      float asp = uRes.x/uRes.y, t = uTime;
      vec3 col = mix(uBottom, uTop, smoothstep(.0, 1., uv.y));
      vec2 p = vec2(uv.x*asp, uv.y);
      float c = fbm(vec3(p*vec2(1.6, 2.8) + vec2(t*.02 + uWind*t*.015, 0.), t*.03), 5);
      float c2 = fbm(vec3(p*4. + vec2(t*.05, 0.), t*.05 + 3.), 3);
      float cloud = smoothstep(.35, .8, c)*smoothstep(.15, .7, uv.y);
      col = mix(col, col*1.9 + .03, cloud*.7);
      col *= .8 + .35*c2;
      // Lightning lights the clouds from inside, strongest near the bolt.
      float near = exp(-abs(uv.x - uBoltX)*asp*2.2);
      col += uLight*uFlash*(.25 + cloud*1.4*(.4 + .6*near))*(.4 + .6*uv.y);
      // The bolt: one jagged line from the cloud base all the way down to the ground (it
      // fades into the mist at the bottom), with one fork part way down.
      if (uBolt > 0.) {
        float top = .82 + .1*fract(uBoltSeed*7.31);
        float dx = (uv.x - boltX(uv.y))*asp;
        float on = smoothstep(top + .04, top - .04, uv.y);
        float core = smoothstep(.0035, .0, abs(dx))*on;
        float glow = exp(-abs(dx)*70.)*on;
        float forkY = .35 + .25*fract(uBoltSeed*3.7);
        float side = sign(fract(uBoltSeed*5.3) - .5);
        float bx = boltX(uv.y) + (forkY - uv.y)*.35*side;
        float bdx = (uv.x - bx - snoise(vec3(uv.y*25., uBoltSeed, 2.))*.01)*asp;
        float branch = smoothstep(.0025, .0, abs(bdx))*step(uv.y, forkY)*smoothstep(forkY - .25, forkY - .05, uv.y);
        col += uLight*(core*2.2 + glow*.7 + branch*1.1)*uBolt;
      }
      // Mist hanging low.
      float m = fbm(vec3(p*vec2(1.5, 5.) + vec2(t*.04, 0.), t*.04 + 8.), 4);
      col = mix(col, uRain*.55 + uLight*uFlash*.3, uMist*smoothstep(.45, .0, uv.y)*(.25 + .55*m));
      gl_FragColor = vec4(col, 1.);
    }`;

	// Each drop is a thin quad, so near drops can be wider than one pixel.
	const ru = {
		uTime: { value: 0 },
		uRes: { value: new Vector2(1, 1) },
		uWind: { value: 0 },
		uSpeed: { value: 1 },
		uRain: { value: new Color() },
		uFlash: { value: 0 },
		uLight: { value: new Color() }
	};
	const gust = /* glsl */ `
    float gust(float t, float z){ return sin(t*.23)*.5 + sin(t*.61 + 1.3)*.3 + sin(t*1.7 + z*3.)*.12; }`;
	const rainMaterial = new ShaderMaterial({
		uniforms: ru,
		transparent: true,
		depthTest: false,
		depthWrite: false,
		blending: AdditiveBlending,
		vertexShader: /* glsl */ `
      attribute vec4 seed; attribute vec2 corner;
      uniform float uTime, uWind, uSpeed; uniform vec2 uRes;
      varying float vA; varying vec2 vC;
      ${gust}
      void main(){
        float z = seed.z*seed.z;            // most drops are far away
        float speed = mix(.7, 2.6, z)*(.85 + .3*seed.w)*uSpeed;
        float len = mix(.018, .11, z)*(.7 + .6*seed.w)*uSpeed;
        float wind = uWind + gust(uTime, z)*.25;
        vec2 dir = normalize(vec2(wind*mix(.45, .8, z), -1.));
        float asp = uRes.x/uRes.y;
        float travel = 1.3 + len;
        float k = fract(seed.y + uTime*speed/travel);
        vec2 head = vec2(seed.x*(1. + abs(wind)*.9) - max(wind, 0.)*.9, 1.1);
        head.x = head.x*asp;
        head += dir*k*travel;
        vec2 side = vec2(-dir.y, dir.x);
        float widthPx = mix(.7, 2.6, z)*max(uRes.y/1000., 1.);
        vec2 pos = head - dir*len*corner.y + side*corner.x*widthPx/uRes.y;
        gl_Position = vec4(pos.x/asp*2. - 1., pos.y*2. - 1., 0., 1.);
        vA = mix(.08, .5, z)*(.6 + .4*seed.w);
        vC = corner;
      }`,
		fragmentShader: /* glsl */ `
      uniform vec3 uRain, uLight; uniform float uFlash;
      varying float vA; varying vec2 vC;
      void main(){
        float a = vA*smoothstep(1., .25, abs(vC.x))*smoothstep(1., .0, vC.y)*smoothstep(.0, .15, vC.y);
        vec3 c = uRain + uLight*uFlash*.8;
        gl_FragColor = vec4(c*a, a);
      }`
	});
	// Splashes: small rings that open and fade near the bottom.
	const splashMaterial = new ShaderMaterial({
		uniforms: ru,
		transparent: true,
		depthTest: false,
		depthWrite: false,
		blending: AdditiveBlending,
		vertexShader: /* glsl */ `
      attribute vec4 seed; uniform float uTime, uSpeed; uniform vec2 uRes; varying float vLife, vA;
      void main(){
        float rate = (1.2 + seed.w)*uSpeed;
        float life = fract(seed.y + uTime*rate);
        float y = pow(seed.z, 1.6)*.2;
        gl_Position = vec4(seed.x*2. - 1., y*2. - 1., 0., 1.);
        vLife = life; vA = mix(.5, .15, seed.z);
        gl_PointSize = (4. + 14.*(1. - seed.z))*life*max(uRes.y/1000., 1.);
      }`,
		fragmentShader: /* glsl */ `
      uniform vec3 uRain; varying float vLife, vA;
      void main(){
        vec2 q = (gl_PointCoord - .5)*vec2(1., 3.2);
        float d = length(q);
        float ring = smoothstep(.08, .0, abs(d - .42))*step(.5, gl_PointCoord.y);
        float a = ring*vA*(1. - vLife/.6)*step(vLife, .6)*2.2;
        gl_FragColor = vec4(uRain*a, a);
      }`
	});

	const CORNERS = [-1, 0, 1, 0, 1, 1, -1, 1];
	function dropGeometry(count: number): BufferGeometry {
		const geometry = new BufferGeometry();
		const seed = new Float32Array(count * 16);
		const corner = new Float32Array(count * 8);
		const index = new Uint32Array(count * 6);
		for (let i = 0; i < count; i++) {
			const s = [Math.random(), Math.random(), Math.random(), Math.random()];
			for (let v = 0; v < 4; v++) {
				seed.set(s, (i * 4 + v) * 4);
				corner[(i * 4 + v) * 2] = CORNERS[v * 2];
				corner[(i * 4 + v) * 2 + 1] = CORNERS[v * 2 + 1];
			}
			index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
		}
		geometry.setAttribute('position', new BufferAttribute(new Float32Array(count * 12), 3));
		geometry.setAttribute('seed', new BufferAttribute(seed, 4));
		geometry.setAttribute('corner', new BufferAttribute(corner, 2));
		geometry.setIndex(new BufferAttribute(index, 1));
		return geometry;
	}
	const density = $derived(num(params, 'density'));
	const drops = $derived(dropGeometry(density));
	const splashes = $derived(seededPoints(Math.round(density / 25), 4));

	// Lightning: each strike is ONE soft flash (quick rise, slow fade over about a second),
	// never a burst of flickers, and strikes are at least four seconds apart. That keeps it
	// well under the WCAG 2.3.1 limit of three flashes in any second. The first strike waits,
	// so a scene held still never stops on a flash.
	let last = clock.t;
	let next = clock.t + 4;
	let strike = -10;
	useTask(
		() => {
			const t = clock.t;
			if (t < last) {
				// The clock wrapped round.
				strike = -10;
				next = t + 4;
			}
			last = t;
			const rate = num(params, 'lightning') / 60;
			if (rate && t > next) {
				strike = t;
				u.uBoltX.value = 0.15 + Math.random() * 0.7;
				u.uBoltSeed.value = Math.random() * 100;
				next = t + Math.max(4, (0.5 + Math.random()) / rate);
			}
			if (!rate) next = Math.max(next, t + 2);
			const dt = t - strike;
			const rise = Math.min(1, dt / 0.08);
			const lit = dt >= 0 && dt <= 2;
			u.uFlash.value = ru.uFlash.value = lit
				? rise * Math.exp(-Math.max(0, dt - 0.08) * 2.6) * 0.8
				: 0;
			u.uBolt.value = lit ? rise * Math.exp(-Math.max(0, dt - 0.15) * 3.5) : 0;
			u.uTime.value = ru.uTime.value = t;
			u.uMist.value = num(params, 'mist');
			u.uWind.value = ru.uWind.value = num(params, 'wind');
			ru.uSpeed.value = num(params, 'speed');
			u.uTop.value.set(hex(params, 'skyTop'));
			u.uBottom.value.set(hex(params, 'skyBottom'));
			u.uRain.value.set(hex(params, 'rain'));
			u.uLight.value.set(hex(params, 'flash'));
			ru.uRain.value.copy(u.uRain.value);
			ru.uLight.value.copy(u.uLight.value);
			renderer.getDrawingBufferSize(ru.uRes.value);
		},
		{ autoInvalidate: false }
	);
	$effect(() => () => {
		rainMaterial.dispose();
		splashMaterial.dispose();
	});
</script>

<T.OrthographicCamera makeDefault position={[0, 0, 5]} />
<FullscreenShader {fragment} uniforms={u} />
<T.Mesh frustumCulled={false} renderOrder={1}>
	<T is={drops} dispose />
	<T is={rainMaterial} />
</T.Mesh>
{#if on(params, 'splashes')}
	<T.Points frustumCulled={false} renderOrder={2}>
		<T is={splashes} dispose />
		<T is={splashMaterial} />
	</T.Points>
{/if}

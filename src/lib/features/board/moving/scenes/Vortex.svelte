<script lang="ts">
	// Vortex: a spiral of light pouring into a dark eye. The arm count is a whole number, so
	// the spiral has no seam. Sparks ride the same spiral inward.
	import { T, useTask, useThrelte } from '@threlte/core';
	import { AdditiveBlending, Color, ShaderMaterial, Vector2 } from 'three';
	import type { MovingParams } from '#lib/core/backgrounds/moving.ts';
	import FullscreenShader from '../gl/FullscreenShader.svelte';
	import { useClock } from '../gl/clock.ts';
	import { NOISE } from '../gl/noise.ts';
	import { hex, num, on } from '../gl/params.ts';
	import { seededPoints } from '../gl/points.ts';
	import { SPARKLE } from '../gl/sparkle.ts';

	let { params }: { params: MovingParams } = $props();
	const clock = useClock();
	const { renderer } = useThrelte();

	const u = {
		uTime: { value: 0 },
		uCount: { value: 3 },
		uTwist: { value: 1 },
		uSpin: { value: 1 },
		uRing: { value: 1 },
		uDeep: { value: new Color() },
		uArms: { value: new Color() },
		uSpark: { value: new Color() },
		uCore: { value: new Color() }
	};
	const fragment = /* glsl */ `
    uniform vec2 uRes; uniform float uTime, uCount, uTwist, uSpin, uRing;
    uniform vec3 uDeep, uArms, uSpark, uCore;
    ${NOISE}
    void main(){
      vec2 d = (gl_FragCoord.xy - .5*uRes)/min(uRes.x, uRes.y);
      float r = length(d) + 1e-4, a = atan(d.y, d.x), t = uTime, lr = log(r);
      float s = a*uCount + lr*uTwist*3. + t*uSpin;
      float n = fbm(vec3(cos(s), sin(s), lr*1.4 - t*.3*uSpin)*1.4, 5);
      float n2 = fbm(vec3(d*2.5, t*.08) + n, 3);
      float arm = pow(.5 + .5*cos(s + (n - .5)*5.), 2.4);
      float fall = smoothstep(1.5, .0, r);
      vec3 col = uDeep*(.5 + .9*n2);
      // Arms crowd together near the eye, so they dim there instead of piling into white.
      float crowd = smoothstep(.06, .45, r);
      col += uArms*arm*fall*(.3 + n)*(.35 + .75*crowd);
      col += uSpark*pow(arm, 9.)*fall*smoothstep(.5, .9, n)*1.3*crowd;
      // Ring 0: the arms fade into a dark centre. Ring 1: a bright ring at the eye.
      float eye = smoothstep(.05, .1, r);
      col *= mix(.02, 1., mix(smoothstep(.0, .3, r), eye, uRing));
      float ring = smoothstep(.12, .085, r)*smoothstep(.045, .08, r);
      col += uCore*ring*1.1*uRing;
      col += uCore*exp(-r*9.)*.18*eye*uRing;
      vec2 sp = d*38.; vec2 cell = floor(sp); float hs = hash(cell);
      col += vec3(step(.986, hs)*smoothstep(.16, .0, length(fract(sp) - .5))*(.55 + .45*sin(t*2. + hs*60.)))*.6*(1. - fall*.7);
      gl_FragColor = vec4(col, 1.);
    }`;

	const pu = {
		uTime: { value: 0 },
		uCount: { value: 3 },
		uTwist: { value: 1 },
		uSpin: { value: 1 },
		uRes: { value: new Vector2(1, 1) },
		uSpark: { value: new Color() },
		uCore: { value: new Color() }
	};
	const sparks = new ShaderMaterial({
		uniforms: pu,
		transparent: true,
		depthTest: false,
		depthWrite: false,
		blending: AdditiveBlending,
		vertexShader: /* glsl */ `
      attribute vec3 seed; uniform float uTime, uCount, uTwist, uSpin; uniform vec2 uRes;
      varying float vLife, vHue, vTw;
      void main(){
        float life = fract(seed.x + uTime*(.035 + .045*seed.z)*max(uSpin, .05));
        float r = mix(1.7, .12, pow(life, .75));
        float k = floor(seed.y*uCount);
        float a = (6.2831853*k - log(r)*uTwist*3. - uTime*uSpin)/uCount + (seed.z - .5)*.5/uCount;
        vec2 d = vec2(cos(a), sin(a))*r;
        float m = min(uRes.x, uRes.y);
        gl_Position = vec4(d*2.*m/uRes, 0., 1.);
        vLife = life; vHue = seed.z;
        vTw = .65 + .35*sin(uTime*(1.5 + seed.y*2.5) + seed.x*60.);
        gl_PointSize = max((7. + 18.*pow(seed.z, 3.))*(1.25 - life*.5)*m/900., 4.);
      }`,
		fragmentShader: /* glsl */ `
      uniform vec3 uSpark, uCore; varying float vLife, vHue, vTw;
      ${SPARKLE}
      void main(){
        float a = sparkle(gl_PointCoord, smoothstep(.85, 1., vHue))*vTw;
        a *= smoothstep(.0, .12, vLife)*smoothstep(1., .7, vLife);
        gl_FragColor = vec4(mix(uSpark, uCore, .3 + .7*vLife*vHue)*a*1.4, a);
      }`
	});
	const count = $derived(num(params, 'particles'));
	const geometry = $derived(seededPoints(count, 3));

	useTask(
		() => {
			for (const x of [u, pu]) {
				x.uTime.value = clock.t;
				x.uCount.value = num(params, 'count');
				x.uTwist.value = num(params, 'twist');
				x.uSpin.value = num(params, 'spin');
			}
			u.uRing.value = on(params, 'ring') ? 1 : 0;
			u.uDeep.value.set(hex(params, 'deep'));
			u.uArms.value.set(hex(params, 'arms'));
			u.uSpark.value.set(hex(params, 'spark'));
			u.uCore.value.set(hex(params, 'core'));
			pu.uSpark.value.copy(u.uSpark.value);
			pu.uCore.value.copy(u.uCore.value);
			renderer.getDrawingBufferSize(pu.uRes.value);
		},
		{ autoInvalidate: false }
	);
	$effect(() => () => sparks.dispose());
</script>

<T.OrthographicCamera makeDefault position={[0, 0, 5]} />
<FullscreenShader {fragment} uniforms={u} />
{#if count > 0}
	<T.Points frustumCulled={false} renderOrder={1}>
		<T is={geometry} dispose />
		<T is={sparks} />
	</T.Points>
{/if}

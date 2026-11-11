<script lang="ts">
	// Fire: warped flames rising from the bottom edge, with embers that drift up, sway and
	// cool. Colours run smoke, embers, flame, hottest from the cool top to the hot base.
	import { T, useTask, useThrelte } from '@threlte/core';
	import { AdditiveBlending, Color, ShaderMaterial, Vector2 } from 'three';
	import type { MovingParams } from '#lib/core/backgrounds/moving.ts';
	import FullscreenShader from '../gl/FullscreenShader.svelte';
	import { useClock } from '../gl/clock.ts';
	import { NOISE } from '../gl/noise.ts';
	import { hex, num } from '../gl/params.ts';
	import { seededPoints } from '../gl/points.ts';
	import { SPARKLE } from '../gl/sparkle.ts';

	let { params }: { params: MovingParams } = $props();
	const clock = useClock();
	const { renderer } = useThrelte();

	const u = {
		uTime: { value: 0 },
		uHeight: { value: 0.7 },
		uTurb: { value: 1 },
		uWind: { value: 0 },
		uDeep: { value: new Color() },
		uEmber: { value: new Color() },
		uFlame: { value: new Color() },
		uCore: { value: new Color() }
	};
	const fragment = /* glsl */ `
    uniform vec2 uRes; uniform float uTime, uHeight, uTurb, uWind;
    uniform vec3 uDeep, uEmber, uFlame, uCore;
    ${NOISE}
    void main(){
      vec2 uv = gl_FragCoord.xy/uRes;
      float asp = uRes.x/uRes.y;
      vec2 p = vec2((uv.x - .5)*asp, uv.y);
      float t = uTime*.55;
      // Lean with the wind more the higher the flame goes.
      p.x -= uWind*uv.y*uv.y*.35;
      vec3 q = vec3(p*vec2(2.2, 1.6), t*.35);
      vec2 w = vec2(fbm(q + vec3(0., -t*1.1, 0.), 3), fbm(q + vec3(5.2, -t*1.3, 1.7), 3));
      float f = fbm(vec3(p*vec2(3., 2.2) + (w - .5)*1.6*uTurb + vec2(0., -t*1.6), t*.5), 4);
      float shape = f*1.5 - uv.y/uHeight*1.05 - .05;
      // Tongues: a slower noise lifts some columns higher than others.
      shape += (fbm(vec3(p.x*1.3, t*.25, 3.), 3) - .5)*.55*uv.y/uHeight;
      float heat = clamp(shape, 0., 1.);
      vec3 col = uDeep*(.35 + .65*smoothstep(1.1, 0., uv.y));
      col = mix(col, uEmber, smoothstep(.0, .22, heat));
      col = mix(col, uFlame, smoothstep(.2, .55, heat));
      col = mix(col, uCore, smoothstep(.65, 1.1, heat)*.75);
      // Warm haze above the flames.
      col += uEmber*.25*smoothstep(uHeight*1.6, 0., uv.y)*(.6 + .4*w.x);
      gl_FragColor = vec4(col, 1.);
    }`;

	const pu = {
		uTime: { value: 0 },
		uRes: { value: new Vector2(1, 1) },
		uWind: { value: 0 },
		uFlame: { value: new Color() },
		uCore: { value: new Color() }
	};
	const embers = new ShaderMaterial({
		uniforms: pu,
		transparent: true,
		depthTest: false,
		depthWrite: false,
		blending: AdditiveBlending,
		vertexShader: /* glsl */ `
      attribute vec4 seed; uniform float uTime, uWind; uniform vec2 uRes;
      varying float vLife, vHot;
      void main(){
        float speed = (.04 + .07*seed.z);
        float life = fract(seed.y + uTime*speed);
        float y = -0.05 + life*1.25;
        float x = seed.x + sin(uTime*(.5 + seed.w*.8) + seed.y*40.)*.025*(1. + life*2.) + uWind*life*life*.25;
        gl_Position = vec4((x*2. - 1.), y*2. - 1., 0., 1.);
        vLife = life; vHot = seed.w;
        float near = .5 + seed.z*seed.z*1.8;
        gl_PointSize = max(near*(2.2 - life*1.2)*min(uRes.x, uRes.y)/120., 4.);
      }`,
		fragmentShader: /* glsl */ `
      uniform vec3 uFlame, uCore; varying float vLife, vHot;
      ${SPARKLE}
      void main(){
        // Embers cool and fade smoothly as they rise; no flicker.
        float a = sparkle(gl_PointCoord, .0);
        a *= smoothstep(.0, .06, vLife)*smoothstep(1., .45, vLife);
        vec3 c = mix(uFlame, uCore, (1. - vLife)*vHot);
        gl_FragColor = vec4(c*a*1.1, a);
      }`
	});
	const count = $derived(num(params, 'embers'));
	const geometry = $derived(seededPoints(count, 4));

	useTask(
		() => {
			u.uTime.value = pu.uTime.value = clock.t;
			u.uHeight.value = num(params, 'height');
			u.uTurb.value = num(params, 'turbulence');
			u.uWind.value = pu.uWind.value = num(params, 'wind');
			u.uDeep.value.set(hex(params, 'deep'));
			u.uEmber.value.set(hex(params, 'ember'));
			u.uFlame.value.set(hex(params, 'flame'));
			u.uCore.value.set(hex(params, 'core'));
			pu.uFlame.value.copy(u.uFlame.value);
			pu.uCore.value.copy(u.uCore.value);
			renderer.getDrawingBufferSize(pu.uRes.value);
		},
		{ autoInvalidate: false }
	);
	$effect(() => () => embers.dispose());
</script>

<T.OrthographicCamera makeDefault position={[0, 0, 5]} />
<FullscreenShader {fragment} uniforms={u} />
{#if count > 0}
	<T.Points frustumCulled={false} renderOrder={1}>
		<T is={geometry} dispose />
		<T is={embers} />
	</T.Points>
{/if}

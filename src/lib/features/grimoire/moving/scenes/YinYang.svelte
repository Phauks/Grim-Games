<script lang="ts">
	// Yin-yang: the taiji turning slowly in still, inky water. Its edges are crisp, the ink
	// inside each half drifts, and faint wisps of both colours curl round it.
	import { T, useTask, useThrelte } from '@threlte/core';
	import { Color, ShaderMaterial, Vector2 } from 'three';
	import type { MovingParams } from '#lib/core/backgrounds/moving.ts';
	import FullscreenShader from '../gl/FullscreenShader.svelte';
	import { useClock } from '../gl/clock.ts';
	import { NOISE } from '../gl/noise.ts';
	import { hex, num } from '../gl/params.ts';

	let { params }: { params: MovingParams } = $props();
	const clock = useClock();
	const { renderer } = useThrelte();
	const u = {
		uTime: { value: 0 },
		uSize: { value: 0.6 },
		uSpin: { value: 0.15 },
		uInk: { value: 0.35 },
		uWisps: { value: 0.5 },
		uLight: { value: new Color() },
		uDark: { value: new Color() },
		uBack: { value: new Color() },
		uGlow: { value: new Color() }
	};
	// The water, wisps and soft glow are smooth, so they go in the smaller smoky buffer like
	// every other scene's, which lowers its detail when frames are missed. Only the symbol
	// needs crisp edges: it is drawn on top at full sharpness, and only inside its disc.
	// (Drawing the whole screen at full sharpness missed frames on phones, which showed as
	// stutter once it turned faster: Trevor, 2026-11-06.)
	const fragment = /* glsl */ `
    uniform vec2 uRes; uniform float uTime, uSize, uSpin, uInk, uWisps;
    uniform vec3 uLight, uDark, uBack, uGlow;
    ${NOISE}
    void main(){
      float m = min(uRes.x, uRes.y);
      vec2 p = (gl_FragCoord.xy - .5*uRes)/m;
      float t = uTime;
      float R = uSize*.5*(1. + .012*sin(t*.4));   // a slow breath, under 1% of its size
      float r = length(p);
      // Water: deep and still, with wisps of both colours curling round the symbol.
      float ang = atan(p.y, p.x);
      vec2 sw = vec2(cos(ang + t*uSpin*.25 + 1.5/(r + .3)), sin(ang + t*uSpin*.25 + 1.5/(r + .3)))*r;
      float w1 = fbm(vec3(sw*2.2, t*.04), 4);
      float w2 = fbm(vec3(sw*2.2 + 4.3, t*.04 + 2.), 4);
      vec3 col = uBack*(.8 + .4*w1);
      float out1 = smoothstep(R*.98, R*1.5, r);
      col = mix(col, uLight, smoothstep(.62, .85, w1)*.18*uWisps*out1);
      col = mix(col, uDark, smoothstep(.62, .85, w2)*.35*uWisps*out1);
      // Glow round the rim.
      col += uGlow*exp(-max(r - R, 0.)*14.)*.35*smoothstep(R*.9, R, r);
      gl_FragColor = vec4(col, 1.);
    }`;

	const su = {
		uTime: u.uTime,
		uSize: u.uSize,
		uSpin: u.uSpin,
		uInk: u.uInk,
		uLight: u.uLight,
		uDark: u.uDark,
		uGlow: u.uGlow,
		uFull: { value: new Vector2(1, 1) }
	};
	const symbol = new ShaderMaterial({
		uniforms: su,
		transparent: true,
		depthTest: false,
		depthWrite: false,
		vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0., 1.); }',
		fragmentShader: /* glsl */ `
    uniform vec2 uFull; uniform float uTime, uSize, uSpin, uInk;
    uniform vec3 uLight, uDark, uGlow;
    ${NOISE}
    // 1 where the taiji is light, 0 where dark, smoothed over aa.
    float taiji(vec2 q, float R, float aa){
      float light = smoothstep(-aa, aa, q.x);
      float upper = smoothstep(aa, -aa, length(q - vec2(0., R*.5)) - R*.5);
      float lower = smoothstep(aa, -aa, length(q + vec2(0., R*.5)) - R*.5);
      light = mix(light, 0., upper);
      light = mix(light, 1., lower);
      float dotU = smoothstep(aa, -aa, length(q - vec2(0., R*.5)) - R*.13);
      float dotL = smoothstep(aa, -aa, length(q + vec2(0., R*.5)) - R*.13);
      light = mix(light, 1., dotU);
      return mix(light, 0., dotL);
    }
    void main(){
      float m = min(uFull.x, uFull.y);
      vec2 p = (gl_FragCoord.xy - .5*uFull)/m;
      float aa = 1.2/m, t = uTime;
      float R = uSize*.5*(1. + .012*sin(t*.4));
      float r = length(p);
      // Outside the disc and its fine rim there is nothing to draw.
      if (r > R + aa*3.) discard;
      float a = -t*uSpin*.5;
      vec2 q = mat2(cos(a), -sin(a), sin(a), cos(a))*p;
      // The ink drifting inside each half (it never crosses the edges).
      float lv = taiji(q, R, aa);
      float ink = fbm(vec3(q*5., t*.05), 3) - .5;
      vec3 light = uLight*(1. + ink*.25*uInk);
      vec3 dark = uDark + (uLight - uDark)*max(ink, 0.)*.12*uInk;
      vec3 sym = mix(dark, light, lv);
      // Soft shading so it reads as a disc, and a fine rim.
      sym *= .92 + .08*smoothstep(R, 0., length(q + vec2(R*.3, -R*.3)));
      float rim = smoothstep(aa*1.5, 0., abs(r - R) - aa)*.6;
      float inside = smoothstep(aa, -aa, r - R);
      // Laid over the water as the symbol, then the rim over that, would be.
      float alpha = 1. - (1. - inside)*(1. - rim);
      vec3 col = (sym*inside*(1. - rim) + uGlow*rim)/max(alpha, 1e-4);
      gl_FragColor = vec4(col, alpha);
    }`
	});

	useTask(
		() => {
			u.uTime.value = clock.t;
			u.uSize.value = num(params, 'size');
			u.uSpin.value = num(params, 'spin');
			u.uInk.value = num(params, 'ink');
			u.uWisps.value = num(params, 'wisps');
			u.uLight.value.set(hex(params, 'light'));
			u.uDark.value.set(hex(params, 'dark'));
			u.uBack.value.set(hex(params, 'back'));
			u.uGlow.value.set(hex(params, 'glow'));
			renderer.getDrawingBufferSize(su.uFull.value);
		},
		{ autoInvalidate: false }
	);
	$effect(() => () => symbol.dispose());
</script>

<T.OrthographicCamera makeDefault position={[0, 0, 5]} />
<FullscreenShader {fragment} uniforms={u} />
<T.Mesh frustumCulled={false} renderOrder={1}>
	<T.PlaneGeometry args={[2, 2]} />
	<T is={symbol} />
</T.Mesh>

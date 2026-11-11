<script lang="ts">
	// The drawing surface for a moving background, loaded only once one is chosen (three.js
	// is large). Multisampling costs a lot at phone pixel densities and every edge here is
	// already soft, so it is only used on low-density screens.
	import { Canvas } from '@threlte/core';
	import { LinearSRGBColorSpace, NoToneMapping, WebGLRenderer } from 'three';
	import type { ComponentProps } from 'svelte';
	import MovingScene from './MovingScene.svelte';

	let props: ComponentProps<typeof MovingScene> = $props();
	const msaa = window.devicePixelRatio < 1.5;
</script>

<Canvas
	renderMode="on-demand"
	toneMapping={NoToneMapping}
	colorManagementEnabled={false}
	colorSpace={LinearSRGBColorSpace}
	createRenderer={(canvas) =>
		new WebGLRenderer({
			canvas,
			antialias: msaa,
			powerPreference: 'high-performance',
			alpha: false,
			stencil: false,
			depth: false
		})}
>
	<MovingScene {...props} />
</Canvas>

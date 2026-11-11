<script lang="ts">
	// A shader that fills the whole scene behind everything else. Smoky layers are smooth, so
	// they are drawn into a smaller buffer (clock.bgScale of the screen's pixels) and stretched
	// with smooth filtering; sparks, drops and stars on top stay at full sharpness. This is most
	// of what keeps phones at full frame rate. uRes (the buffer's size) is kept up to date here.
	import { T, useTask, useThrelte } from '@threlte/core';
	import {
		LinearFilter,
		Mesh,
		OrthographicCamera,
		PlaneGeometry,
		Scene,
		ShaderMaterial,
		Vector2,
		WebGLRenderTarget,
		type IUniform
	} from 'three';
	import { untrack } from 'svelte';
	import { useClock } from './clock.ts';

	interface Props {
		fragment: string;
		uniforms: Record<string, IUniform>;
		/** Always full resolution, for a scene with crisp edges. */
		sharp?: boolean;
	}
	let { fragment, uniforms, sharp = false }: Props = $props();
	const { renderer, shouldRender } = useThrelte();
	const clock = useClock();
	const res = new Vector2(1, 1);
	const material = untrack(() => {
		uniforms.uRes = { value: res };
		return new ShaderMaterial({
			vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0., 1.); }',
			fragmentShader: fragment,
			uniforms,
			depthWrite: false,
			depthTest: false
		});
	});
	const plane = new PlaneGeometry(2, 2);
	const offScene = new Scene();
	const quad = new Mesh(plane, material);
	quad.frustumCulled = false;
	offScene.add(quad);
	const offCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
	const target = new WebGLRenderTarget(1, 1, {
		depthBuffer: false,
		minFilter: LinearFilter,
		magFilter: LinearFilter
	});
	const show = new ShaderMaterial({
		vertexShader:
			'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.); }',
		fragmentShader:
			'uniform sampler2D map; varying vec2 vUv; void main(){ gl_FragColor = texture2D(map, vUv); }',
		uniforms: { map: { value: target.texture } },
		depthWrite: false,
		depthTest: false
	});
	const full = new Vector2();
	useTask(
		() => {
			if (!shouldRender()) return;
			renderer.getDrawingBufferSize(full);
			const s = sharp ? 1 : clock.bgScale;
			const w = Math.max(1, Math.round(full.x * s));
			const h = Math.max(1, Math.round(full.y * s));
			if (target.width !== w || target.height !== h) target.setSize(w, h);
			res.set(w, h);
			const before = renderer.getRenderTarget();
			renderer.setRenderTarget(target);
			renderer.render(offScene, offCamera);
			renderer.setRenderTarget(before);
		},
		{ autoInvalidate: false }
	);
	$effect(() => () => {
		material.dispose();
		show.dispose();
		plane.dispose();
		target.dispose();
	});
</script>

<T.Mesh frustumCulled={false} renderOrder={-10}>
	<T.PlaneGeometry args={[2, 2]} />
	<T is={show} />
</T.Mesh>

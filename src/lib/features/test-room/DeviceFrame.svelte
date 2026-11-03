<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Device } from './devices.ts';

	/**
	 * The real app in a frame the size of one device's screen, scaled by `zoom` and never wider
	 * than `room` (the Test room's screens, the Character Lab's Storyteller screen): the frame
	 * lays out exactly as that device would.
	 */
	interface Props {
		device: Pick<Device, 'width' | 'height'>;
		caption: string;
		/** The frame's accessible title. */
		title: string;
		src: string;
		/** The frame window's name (a Test room phone keeps its own storage under it). */
		name?: string;
		zoom: number | string;
		/** The width of the area the frame sits in, in CSS pixels; 0 or absent for no limit. */
		room?: number;
		testid?: string;
		iframe?: HTMLIFrameElement;
		/** Text or controls after the caption, on its line. */
		aside?: Snippet;
	}

	let {
		device,
		caption,
		title,
		src,
		name,
		zoom,
		room,
		testid,
		iframe = $bindable(),
		aside
	}: Props = $props();
</script>

<figure
	style:--w={device.width}
	style:--h={device.height}
	style:--zoom={zoom}
	style:--room={room || undefined}
	data-testid={testid}
>
	<figcaption><span>{caption}</span>{@render aside?.()}</figcaption>
	<div class="screen">
		<iframe {title} {name} bind:this={iframe} {src}></iframe>
	</div>
</figure>

<style>
	/* The zoom picked, or less where the screen would be wider than the area (Trevor's Pixel,
	   2026-10-31: a tablet screen at 50% ran off the side of the phone): the area's width less
	   its padding and a frame's border, in CSS pixels. */
	figure {
		--fit: min(var(--zoom), (var(--room, 100000) - 80) / var(--w));
		margin: 0;
		display: grid;
		gap: var(--space-1);
	}
	figcaption {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--space-2);
		font-size: 0.85rem;
	}
	/* The device's own CSS pixels, scaled by the zoom: the frame lays out exactly as that device. */
	.screen {
		width: calc(var(--w) * var(--fit) * 1px); /* px-ok: a device's CSS viewport */
		height: calc(var(--h) * var(--fit) * 1px); /* px-ok: a device's CSS viewport */
		overflow: hidden;
		border: 0.15rem solid var(--border);
		border-radius: 1rem;
		background: var(--surface);
	}
	iframe {
		width: calc(var(--w) * 1px); /* px-ok: a device's CSS viewport */
		height: calc(var(--h) * 1px); /* px-ok: a device's CSS viewport */
		border: 0;
		transform: scale(var(--fit));
		transform-origin: 0 0;
	}
</style>

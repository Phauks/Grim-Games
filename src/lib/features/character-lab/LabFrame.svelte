<script lang="ts">
	import { untrack } from 'svelte';
	import { LAB_FRAME_NAME } from '#lib/features/room/host-storage.ts';
	import DeviceFrame from '#lib/features/test-room/DeviceFrame.svelte';
	import type { Device } from '#lib/features/test-room/devices.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onLabFrameReady, openInLabFrame } from './lab-frame.ts';
	import type { LabSession } from './lab-session.svelte.ts';

	/**
	 * The lab's Storyteller screen, beside the table or under it. One frame for every load: a
	 * new game opens inside the app already running in it, about four times faster than loading
	 * the app again (load timing, 2026-11-06). Until that app says it is listening (it is still
	 * starting), the frame loads the game afresh.
	 */
	interface Props {
		session: LabSession;
		device: Device;
		/** The width it may fill. */
		room: number;
	}

	let { session, device, room }: Props = $props();

	let frame = $state<HTMLIFrameElement>();
	let src = $state(untrack(() => session.gamePath ?? '/'));
	let listening = false;
	let shown = untrack(() => session.loads);
	$effect(() =>
		onLabFrameReady(
			() => frame?.contentWindow,
			() => (listening = true)
		)
	);
	$effect(() => {
		const loads = session.loads;
		const gameId = session.setup.gameId;
		const path = session.gamePath;
		if (loads === shown || !gameId || !path) return;
		shown = loads;
		const inFrame = untrack(() => frame?.contentWindow);
		if (listening && inFrame) openInLabFrame(inFrame, gameId);
		else {
			listening = false;
			src = path;
		}
	});
</script>

<!-- Its window name keeps its game out of this device's room (host-storage.ts). No caption
     over it (Trevor, 2026-11-05: "remove text"). -->
<DeviceFrame
	bind:iframe={frame}
	{device}
	title={t('lab.storyteller')}
	name={LAB_FRAME_NAME}
	{src}
	zoom={1}
	{room}
	square
	testid="lab-frame"
/>

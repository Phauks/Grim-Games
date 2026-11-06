<script lang="ts">
	import { LAB_FRAME_NAME } from '#lib/features/room/host-storage.ts';
	import DeviceFrame from '#lib/features/test-room/DeviceFrame.svelte';
	import type { Device } from '#lib/features/test-room/devices.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { LabSession } from './lab-session.svelte.ts';

	interface Props {
		session: LabSession;
		device: Device;
		/** The width it may fill. */
		room: number;
	}

	let { session, device, room }: Props = $props();
</script>

<!-- The lab's Storyteller screen, beside the table or under it, made again for each load. Its
     window name keeps its game out of this device's room (host-storage.ts). No caption over it
     (Trevor, 2026-11-05: "remove text"). -->
{#key `${session.gamePath}:${session.loads}`}
	<DeviceFrame
		{device}
		title={t('lab.storyteller')}
		name={LAB_FRAME_NAME}
		src={session.gamePath ?? '/'}
		zoom={1}
		{room}
		square
		testid="lab-frame"
	/>
{/key}

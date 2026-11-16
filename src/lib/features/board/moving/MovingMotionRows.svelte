<script lang="ts">
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { movingMotion } from './motion.svelte.ts';

	/**
	 * How an animated background is drawn on this device (M43), under the background it
	 * changes: held in place and disabled while the background isn't an animated one or
	 * animations are off, so the preview beside it always shows what it does.
	 */
	let { enabled }: { enabled: boolean } = $props();
</script>

<SettingToggle
	label="Animated background at 30 frames a second"
	checked={movingMotion.current.fps === '30'}
	disabled={!enabled}
	onChange={(on) => movingMotion.update({ fps: on ? '30' : 'screen' })}
/>

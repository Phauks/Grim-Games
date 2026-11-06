<script lang="ts">
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { movingMotion } from './motion.svelte.ts';

	/**
	 * How an animated background moves on this device (M43), under the background it changes:
	 * held in place and disabled while the background isn't an animated one, so the preview
	 * beside them always shows what they do.
	 */
	let { enabled }: { enabled: boolean } = $props();
</script>

<SettingToggle
	label="Animated background at 30 frames a second"
	checked={movingMotion.current.fps === '30'}
	disabled={!enabled}
	onChange={(on) => movingMotion.update({ fps: on ? '30' : 'screen' })}
/>
<SettingSelect
	label="Animated background with Reduce motion"
	value={movingMotion.current.reduceMotion}
	options={[
		{ value: 'still', label: 'Hold still' },
		{ value: 'gentle', label: 'Move gently' },
		{ value: 'ignore', label: 'Move as usual' }
	]}
	defaultValue="still"
	disabled={!enabled}
	onChange={(reduceMotion) => movingMotion.update({ reduceMotion })}
/>

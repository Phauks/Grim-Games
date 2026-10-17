<script lang="ts">
	import { boardLooks, DEFAULT_BOARD_LOOKS } from '#lib/features/grimoire/board-looks.svelte.ts';
	import { intl } from '#lib/i18n/locale.svelte.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';

	/**
	 * The board's device looks (Trevor, 2026-10-17: settings appear where they act and in
	 * Settings), the same store as the board's Background dialog, so both change one value.
	 */
</script>

<SettingToggle
	label="Vignette"
	checked={boardLooks.current.vignette}
	onChange={(vignette) => boardLooks.update({ vignette })}
/>
<SettingSlider
	label="Vignette strength"
	value={boardLooks.current.vignetteStrength}
	min={0}
	max={1}
	step={0.05}
	defaultValue={DEFAULT_BOARD_LOOKS.vignetteStrength}
	format={(strength) => intl.number(strength, { style: 'percent' })}
	onChange={(vignetteStrength) => boardLooks.update({ vignetteStrength })}
/>
<!-- A dropdown like the other choices in Settings; the Background dialog shows the same choice. -->
<SettingSelect
	label="Fabled and Loric"
	value={boardLooks.current.rulesAt}
	options={[
		{ value: 'middle', label: 'Middle' },
		{ value: 'edge', label: 'Edge, smaller' }
	]}
	defaultValue={DEFAULT_BOARD_LOOKS.rulesAt}
	onChange={(rulesAt) => boardLooks.update({ rulesAt })}
/>

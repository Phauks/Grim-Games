<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { CornerLine } from '#lib/ui/corner-lines.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { cornerLineLabel } from './corner-line-labels.ts';

	/**
	 * One line of the board's corner as a setting: the same choice as its eye in Game info
	 * (Trevor, 2026-10-24), in Settings > Board. Under its Board corner heading the name alone,
	 * no "on the board" (Trevor, 2026-10-27: "since it is implied").
	 */
	interface Props {
		line: CornerLine;
	}

	let { line }: Props = $props();
</script>

<SettingToggle
	label={cornerLineLabel(line)}
	checked={preferences.current.cornerLines[line]}
	onChange={(on) =>
		preferences.update({ cornerLines: { ...preferences.current.cornerLines, [line]: on } })}
/>

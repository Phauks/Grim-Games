<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { ASSIST_LABELS } from '#lib/ui/assistance.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import StepFocusSetting, {
		STEP_FOCUS_LABEL
	} from '#lib/features/grimoire/night/StepFocusSetting.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import SettingHeading from '#lib/ui/settings/SettingHeading.svelte';
	import BoardLooksRows from './BoardLooksRows.svelte';
	import { STORYTELLER_GROUPS } from './storyteller-groups.ts';
	import CornerLineToggle from '#lib/features/modes/CornerLineToggle.svelte';
	import { CORNER_LINES } from '#lib/ui/corner-lines.ts';

	/**
	 * How the grimoire board looks and behaves, its background apart: the game pane's
	 * Theme > Board, and the player's Theme sheet.
	 */
	const assistance = $derived(preferences.current.assistance);
</script>

<BoardLooksRows />
{#each STORYTELLER_GROUPS.board as key (key)}
	<SettingToggle
		label={ASSIST_LABELS[key].label}
		description={ASSIST_LABELS[key].description}
		checked={assistance[key]}
		onChange={(checked) => preferences.update({ assistance: { ...assistance, [key]: checked } })}
	/>
{/each}
<SettingRow label={STEP_FOCUS_LABEL}>
	{#snippet control(labelId)}<StepFocusSetting labelledBy={labelId} />{/snippet}
</SettingRow>

<!-- The corner's lines, the same choices as the eyes in Game info (Trevor, 2026-10-24). -->
<SettingHeading title={t('settings.groupCorner')} />
{#each CORNER_LINES as line (line)}<CornerLineToggle {line} />{/each}

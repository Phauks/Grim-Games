<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { ASSIST_LABELS } from '#lib/ui/assistance.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import ReminderModeSetting, {
		REMINDER_MODE_LABEL
	} from '#lib/features/grimoire/ReminderModeSetting.svelte';
	import StepFocusSetting, {
		STEP_FOCUS_LABEL
	} from '#lib/features/grimoire/StepFocusSetting.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import BoardLooksRows from './BoardLooksRows.svelte';
	import BoardPreview from './BoardPreview.svelte';
	import SettingGroup from '#lib/ui/settings/SettingGroup.svelte';
	import RulesLooksRows from './RulesLooksRows.svelte';
	import DefaultBackgroundRow from './DefaultBackgroundRow.svelte';
	import BoardBackgroundRow from '#lib/features/grimoire/BoardBackgroundRow.svelte';
	import { boardBackground } from '#lib/features/grimoire/board-background.svelte.ts';
	import { STORYTELLER_GROUPS } from './storyteller-groups.ts';
	import { boardLooks } from '#lib/features/grimoire/board-looks.svelte.ts';

	/**
	 * How the grimoire board looks and behaves (Trevor, 2026-10-18: tokens have their own
	 * section), also opened on its own from the board's menu with `settingsDialog.showOnly('board')`.
	 */
	const assistance = $derived(preferences.current.assistance);
</script>

<!-- A live preview beside the looks it shows (Trevor, 2026-10-20), as in Tokens. -->
<SettingGroup title={t('settings.boardPreview')} testid="board-preview">
	{#snippet preview()}<BoardPreview />{/snippet}
	<!-- With a board open, its own background too (the board thread, Trevor 2026-10-18). -->
	{#if boardBackground.context}<BoardBackgroundRow
			board={boardBackground.context}
		/>{:else}<DefaultBackgroundRow />{/if}
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

	<h3>{t('settings.groupRules')}</h3>
	<RulesLooksRows />
</SettingGroup>

<!-- Where reminders sit, apart and closed, marked with a warning before it is touched, since
     leaving them where dropped turns a lot off (Trevor, 2026-10-23). Its Confirm still lists
     what changes (Trevor, 2026-10-17). The board's ⋯ > Board opens this section too. -->
<Collapsible
	title={t('settings.boardAdvanced')}
	level={3}
	storageKey="settings-board-advanced"
	defaultOpen={false}
	count={3}
>
	<SettingRow label={REMINDER_MODE_LABEL} warning={t('settings.reminderModeWarning')}>
		{#snippet control(labelId)}<ReminderModeSetting labelledBy={labelId} />{/snippet}
	</SettingRow>
	<SettingToggle
		label={t('settings.holdLightsSeat')}
		description={t('settings.holdLightsSeatDescription')}
		checked={boardLooks.current.holdLights === 'seat'}
		onChange={(on) => boardLooks.update({ holdLights: on ? 'seat' : 'character' })}
	/>
	<!-- Both ways built so Trevor can pick after trying them (2026-10-23). -->
	<SettingToggle
		label={t('settings.dragSourceBank')}
		description={t('settings.dragSourceBankDescription')}
		checked={boardLooks.current.dragSource === 'bank'}
		onChange={(on) => boardLooks.update({ dragSource: on ? 'bank' : 'pill' })}
	/>
</Collapsible>

<style>
	h3 {
		margin: var(--space-5) 0 var(--space-1);
		font-family: var(--font-control);
		font-size: 0.75rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--on-surface-muted);
	}
</style>

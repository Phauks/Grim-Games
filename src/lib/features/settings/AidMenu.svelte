<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { ASSIST_LABELS, type AssistKey } from '#lib/ui/assistance.ts';
	import Menu from '#lib/ui/primitives/Menu.svelte';
	import { settingsDialog } from './settings-dialog.svelte.ts';

	/**
	 * The ⋯ beside an aid prompt's X (Trevor, 2026-10-30): the aid's switch lives only in
	 * Settings, so the prompt offers View in settings, which opens Settings at that switch
	 * over the prompt, which stays open under it.
	 */
	interface Props {
		/** One of Settings › Storyteller's switches (STORYTELLER_HELP_KEYS). */
		aid: AssistKey;
	}

	let { aid }: Props = $props();
</script>

<Menu
	label={t('settings.aidMenu')}
	items={[
		{
			value: 'settings',
			label: t('settings.viewInSettings'),
			onSelect: () => settingsDialog.showSetting('assistance', ASSIST_LABELS[aid].label)
		}
	]}
/>

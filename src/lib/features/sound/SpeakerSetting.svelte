<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import { canChooseSpeaker, speakers, useSpeaker } from './speaker.svelte.ts';

	/**
	 * The speaker every sound plays on (plan U11), in Settings > Sound and on the Soundboard
	 * sheet. Disabled where the browser can't choose (phones, Firefox, Safari), so nothing
	 * moves. Kept on this device, never in a settings profile.
	 */
	const can = canChooseSpeaker();
	onMount(() => void speakers.refresh());

	function choose(speaker: string) {
		preferences.update({ speaker });
		void useSpeaker(speaker);
	}
</script>

<SettingSelect
	label={t('settings.speaker')}
	value={preferences.current.speaker}
	options={[
		{ value: '', label: t('settings.speakerDefault') },
		...speakers.list.map((speaker, i) => ({
			value: speaker.id,
			label: speaker.label || t('settings.speakerUnnamed', { n: i + 1 })
		}))
	]}
	defaultValue=""
	disabled={!can}
	onChange={choose}
/>
<SettingRow label={t('settings.speakerNames')}>
	{#snippet control(labelId)}
		<Button
			aria-describedby={labelId}
			disabled={!can || speakers.named}
			onclick={() => void speakers.showNames()}>{t('settings.speakerNamesShow')}</Button
		>
	{/snippet}
</SettingRow>

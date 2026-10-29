<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Select from '#lib/ui/primitives/Select.svelte';
	import { settingsProfiles } from './settings-profiles.svelte.ts';

	interface Props {
		/** The chosen profile; the one in use when not given. */
		value?: string;
		/** What picking one does; switches to it when not given. */
		onChange?: (id: string) => void;
		/** Shows its "Settings profile" label; hidden in a section heading or a setting row. */
		showLabel?: boolean;
	}

	let { value, onChange, showLabel = false }: Props = $props();
	const options = $derived(settingsProfiles.list.map((p) => ({ value: p.id, label: p.name })));
</script>

<!-- One profile drop-down wherever a profile is picked (plan S18): Settings section headings,
     the board's Board and Tokens sheets, and Character selection's Game settings. Always shown, even with one profile. -->
<div class="profile-select" data-testid="profile-select">
	<Select
		label={t('settings.profile')}
		hideLabel={!showLabel}
		value={value ?? settingsProfiles.activeId}
		{options}
		onChange={(id) => (onChange ? onChange(id) : void settingsProfiles.use(id))}
	/>
</div>

<style>
	.profile-select {
		min-width: 0;
	}
</style>

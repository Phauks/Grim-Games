<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import { settingsProfiles } from './settings-profiles.svelte.ts';
</script>

<!-- The Profiles section's heading control (item controls in headers, Trevor). -->
<IconButton
	icon="add"
	label={t('settings.profileNew')}
	outlined
	onclick={() => settingsProfiles.add()}
/>

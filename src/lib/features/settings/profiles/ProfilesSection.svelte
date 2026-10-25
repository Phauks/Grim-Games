<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import { NAME_MAX, type SettingsProfile } from './profile-values.ts';
	import { settingsProfiles } from './settings-profiles.svelte.ts';

	/**
	 * Settings profiles (plan S18): one divided row per profile with its name, the Default
	 * chip, Duplicate and a red trash. The heading's drop-down picks the one in use; its +
	 * adds one with the app's default settings.
	 */
	let deleting = $state<SettingsProfile>();
	let confirmOpen = $state(false);
	const only = $derived(settingsProfiles.list.length === 1);
</script>

<ul class="profiles">
	{#each settingsProfiles.list as profile (profile.id)}
		<li data-setting data-testid="profile-row">
			<div class="name">
				<TextField
					label={t('settings.profileName')}
					hideLabel
					value={profile.name}
					maxlength={NAME_MAX}
					oninput={(name) => settingsProfiles.rename(profile.id, name)}
				/>
			</div>
			<Chip
				pressed={profile.id === settingsProfiles.defaultId}
				aria-label={t('settings.profileMakeDefault', { name: profile.name })}
				onclick={() => settingsProfiles.makeDefault(profile.id)}
				>{t('settings.profileDefault')}</Chip
			>
			<IconButton
				icon="copy"
				label={t('settings.profileDuplicate', { name: profile.name })}
				onclick={() => void settingsProfiles.duplicate(profile.id)}
			/>
			<!-- The last profile can't go: disabled, not hidden, so nothing moves. -->
			<DeleteButton
				label={t('settings.profileDelete', { name: profile.name })}
				disabled={only}
				onclick={() => {
					deleting = profile;
					confirmOpen = true;
				}}
			/>
		</li>
	{/each}
</ul>

<ConfirmDialog
	bind:open={confirmOpen}
	title={t('settings.profileDeleteTitle', { name: deleting?.name ?? '' })}
	danger
	onConfirm={() => {
		if (deleting) void settingsProfiles.remove(deleting.id);
		confirmOpen = false;
	}}
>
	<p>{t('settings.profileDeleteText')}</p>
</ConfirmDialog>

<style>
	.profiles {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		/* The line between profiles is every setting's line (ui/base.css, S20). */
		padding: var(--space-2) 0;
	}
	.name {
		flex: 1;
		min-width: 0;
	}
</style>

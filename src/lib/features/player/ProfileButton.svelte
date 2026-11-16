<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { settingsDialog } from '#lib/features/settings/settings-dialog.svelte.ts';
	import ProfileAvatar from './ProfileAvatar.svelte';
	import { profileDialog } from './profile-dialog.svelte.ts';

	/**
	 * Opens the Profile from Settings' header, beside the X (Trevor, 2026-10-27): the word
	 * Profile on the top line, then the player's own avatar in their laurel (2026-10-28). The
	 * Profile is its own dialog (2026-11-15), so it takes Settings' place rather than stacking.
	 */
	function open() {
		settingsDialog.open = false;
		profileDialog.show();
	}
</script>

<button type="button" class="profile-button" data-testid="profile-button" onclick={open}>
	<span class="label">{t('player.profile')}</span>
	<span class="avatar"><ProfileAvatar /></span>
</button>

<style>
	.profile-button {
		display: inline-flex;
		flex: none;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		cursor: pointer;
	}
	.avatar {
		flex: none;
		width: var(--tap-target);
		height: var(--tap-target);
	}
</style>

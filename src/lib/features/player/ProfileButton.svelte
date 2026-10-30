<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ProfileAvatar from './ProfileAvatar.svelte';

	/**
	 * Opens the Profile from Settings' header, beside the X (Trevor, 2026-10-27): the word
	 * Profile on the top line, then the player's own avatar in their laurel (2026-10-28).
	 */
	let { onclick }: { onclick: () => void } = $props();
</script>

<button type="button" class="profile-button" data-testid="profile-button" {onclick}>
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

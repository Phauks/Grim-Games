<script lang="ts">
	import { savedPlayerName } from '#lib/features/room/player.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import AvatarFace from '#lib/ui/seating/AvatarFace.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import { avatarPicture } from './avatar-picture.svelte.ts';
	import AvatarCropDialog from './AvatarCropDialog.svelte';
	import type { AvatarCrop } from '#lib/core/avatars/crop.ts';

	/**
	 * The player's own picture for their seat (Trevor, 2026-10-27: "allow setting users
	 * profile/icon in the player settings"), in Settings > Player and the player screen's own
	 * settings. The token beside it shows what the table will see; without a picture, the
	 * initials. The trash is always there, disabled without a picture, so nothing moves.
	 */
	interface Props {
		/** The name the initials come from; else the one this phone last gave a room. */
		name?: string;
		/** Locked while a game is under way (room-look.ts). */
		disabled?: boolean;
	}

	let { name, disabled = false }: Props = $props();
	let input = $state<HTMLInputElement>();
	let error = $state('');

	/** The picture just picked, on the crop screen (Trevor, 2026-10-27) until it is saved. */
	let picking = $state<Blob>();
	let start = $state<AvatarCrop>();
	let cropping = $state(false);
	/** A tap on the picture opens its crop screen again, on the whole picture (2026-10-27). */
	async function edit() {
		const editable = await avatarPicture.editable();
		if (!editable) return;
		error = '';
		picking = editable.file;
		start = editable.crop;
		cropping = true;
	}
	function picked(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (input) input.value = '';
		if (!file) return;
		error = '';
		picking = file;
		start = undefined;
		cropping = true;
	}
	async function save(file: Blob, crop: AvatarCrop) {
		error = (await avatarPicture.choose(file, crop)) ? '' : t('player.pictureError');
	}
</script>

<SettingRow label={t('player.picture')} description={t('player.pictureDetail')}>
	{#snippet control(labelId)}
		<div class="control" role="group" aria-labelledby={labelId} data-testid="avatar-picture">
			<!-- Always a button, so nothing moves; usable once there is a picture to edit. -->
			<button
				type="button"
				class="token"
				aria-label={t('player.pictureEdit')}
				disabled={disabled || !avatarPicture.url}
				onclick={edit}
				><AvatarFace
					avatar="initials"
					name={name || savedPlayerName()}
					picture={avatarPicture.url}
				/></button
			>
			<Button icon="add" {disabled} onclick={() => input?.click()}
				>{avatarPicture.url ? t('player.pictureChange') : t('player.pictureChoose')}</Button
			>
			<DeleteButton
				label={t('player.pictureRemove')}
				disabled={disabled || !avatarPicture.url}
				onclick={() => avatarPicture.clear()}
			/>
			<input
				bind:this={input}
				class="file"
				type="file"
				accept="image/*"
				aria-label={t('player.pictureFile')}
				onchange={picked}
			/>
		</div>
		<!-- One reserved line, so an error never moves the rows below. -->
		<p class="error" role="status">{error}</p>
	{/snippet}
</SettingRow>

<AvatarCropDialog bind:open={cropping} file={picking} initial={start} onSave={save} />

<style>
	.control {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: var(--space-2);
	}
	.token {
		display: block;
		flex: none;
		width: var(--tap-target);
		height: var(--tap-target);
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		cursor: pointer;
	}
	.token:disabled {
		cursor: default;
	}
	.error {
		min-height: 1.3em;
		margin: var(--space-1) 0 0;
		color: var(--accent);
		font-size: 0.85rem;
	}
	.file {
		display: none;
	}
</style>

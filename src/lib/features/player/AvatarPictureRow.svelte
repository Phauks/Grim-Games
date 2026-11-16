<script lang="ts">
	import { savedPlayerName } from '#lib/features/room/player.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Menu from '#lib/ui/primitives/Menu.svelte';
	import AvatarFace from '#lib/ui/seating/AvatarFace.svelte';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import { avatarPicture } from './avatar-picture.svelte.ts';
	import AvatarCropDialog from './AvatarCropDialog.svelte';
	import type { AvatarCrop } from '#lib/core/avatars/crop.ts';

	/**
	 * The player's own picture for their seat (Trevor, 2026-10-27: "allow setting users
	 * profile/icon in the player settings"), in the Profile and the player screen's own
	 * settings. The token shows what the table will see; without a picture, the initials. A
	 * pencil on the token is its only control (Trevor, 2026-11-16): a menu to choose a picture,
	 * move or zoom it, or remove it, the last two disabled without one so nothing moves.
	 */
	interface Props {
		/** The name the initials come from; else the one this phone last gave a room. */
		name?: string;
	}

	let { name }: Props = $props();
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

<SettingRow label={t('player.picture')}>
	{#snippet control(labelId)}
		<div class="control" role="group" aria-labelledby={labelId} data-testid="avatar-picture">
			<Menu
				label={t('player.pictureEdit')}
				items={[
					{
						value: 'choose',
						label: avatarPicture.url ? t('player.pictureChange') : t('player.pictureChoose'),
						icon: 'add',
						onSelect: () => input?.click()
					},
					{
						value: 'crop',
						label: t('player.pictureCropAction'),
						disabled: !avatarPicture.url,
						onSelect: edit
					},
					{
						value: 'remove',
						label: t('player.pictureRemove'),
						disabled: !avatarPicture.url,
						onSelect: () => avatarPicture.clear()
					}
				]}
				triggerAttrs={{ 'data-testid': 'avatar-picture-edit' }}
			>
				{#snippet trigger()}<span class="token"
						><AvatarFace
							avatar="initials"
							name={name || savedPlayerName()}
							picture={avatarPicture.url}
						/><span class="pencil"><Icon name="edit" /></span></span
					>{/snippet}
			</Menu>
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
		position: relative;
		display: block;
		width: var(--tap-target);
		height: var(--tap-target);
	}
	/* A small pencil on the token's lower right, so the token reads as something to edit. */
	.pencil {
		position: absolute;
		inset: auto -4% -4% auto;
		display: grid;
		place-items: center;
		width: 50%;
		height: 50%;
		border: var(--control-border);
		border-radius: 50%;
		background: var(--surface-raised);
		color: var(--on-surface);
		--icon-size: 70%;
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

<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { QR_CENTRES, type QrCentre } from '#lib/ui/preferences.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import { chooseQrPicture, qrPicture } from './qr-picture.svelte.ts';

	/**
	 * What goes in the middle of share QR codes (Trevor, 2026-10-20, plan R1: the Storyteller
	 * picks what, if anything, goes there). In Settings and beside every QR code, the same
	 * control. Picking Your picture with none chosen yet asks for one.
	 */
	let input = $state<HTMLInputElement>();
	let error = $state('');

	function change(qrCentre: QrCentre) {
		preferences.update({ qrCentre });
		if (qrCentre === 'picture' && !qrPicture.current) input?.click();
	}

	async function picked(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0];
		if (input) input.value = '';
		if (!file) return;
		error = (await chooseQrPicture(file)) ? '' : t('share.qrCentre.pictureError');
	}
</script>

<SettingSelect
	label={t('share.qrCentre')}
	value={preferences.current.qrCentre}
	options={QR_CENTRES.map((value) => ({ value, label: t(`share.qrCentre.${value}`) }))}
	defaultValue="script"
	onChange={change}
/>
<div class="picture">
	<!-- Its place is kept while there is no picture, so choosing one moves nothing. -->
	<span class="thumb"
		>{#if qrPicture.current}<img src={qrPicture.current} alt="" />{/if}</span
	>
	<!-- Always here, so nothing moves; usable while Your picture is chosen. -->
	<Button
		icon="uploadFile"
		disabled={preferences.current.qrCentre !== 'picture'}
		onclick={() => input?.click()}
		>{qrPicture.current ? t('share.qrCentre.change') : t('share.qrCentre.choose')}</Button
	>
	<p class="error" role="status">{error}</p>
</div>
<input
	bind:this={input}
	class="file"
	type="file"
	accept="image/*"
	aria-label={t('share.qrCentre.file')}
	onchange={picked}
/>

<style>
	.picture {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.thumb {
		flex: none;
		width: var(--tap-target);
		height: var(--tap-target);
		overflow: hidden;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
	}
	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.error {
		min-height: 1.4em;
		margin: 0;
		color: var(--on-surface-muted);
	}
	.file {
		display: none;
	}
</style>

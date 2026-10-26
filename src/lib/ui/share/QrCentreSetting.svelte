<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import {
		QR_CENTRES,
		QR_FINDERS,
		QR_MODULES,
		QR_PICTURE_CORNERS,
		QR_PICTURE_ZOOM,
		type QrCentre
	} from '#lib/ui/preferences.ts';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import { chooseQrPicture, qrPicture } from './qr-picture.svelte.ts';

	/**
	 * What goes in the middle of share QR codes (Trevor, 2026-10-20, plan R1: the Storyteller
	 * picks what, if anything, goes there). In Settings and beside every QR code, the same
	 * control. Choosing Your picture opens nothing by itself (Trevor, 2026-10-23); Choose picture
	 * does, and the picture's shape and the code's squares are set below it, each shown at once
	 * on the QR beside them.
	 */
	let input = $state<HTMLInputElement>();
	const shaping = $derived(preferences.current.qrCentre === 'picture' && !!qrPicture.current);
	let error = $state('');

	function change(qrCentre: QrCentre) {
		preferences.update({ qrCentre });
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
<div class="picture" data-setting>
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
<!-- The picture's shape: shown, disabled, until there is a picture in the middle (no reflow). -->
<SettingToggle
	label={t('share.qrPicture.whole')}
	checked={preferences.current.qrPictureWhole}
	disabled={!shaping}
	onChange={(qrPictureWhole) => preferences.update({ qrPictureWhole })}
/>
<SettingSlider
	label={t('share.qrPicture.zoom')}
	value={preferences.current.qrPictureZoom}
	min={QR_PICTURE_ZOOM.min}
	max={QR_PICTURE_ZOOM.max}
	step={QR_PICTURE_ZOOM.step}
	defaultValue={1}
	disabled={!shaping}
	onChange={(qrPictureZoom) => preferences.update({ qrPictureZoom })}
/>
<SettingSelect
	label={t('share.qrPicture.corners')}
	value={preferences.current.qrPictureCorners}
	options={QR_PICTURE_CORNERS.map((value) => ({
		value,
		label: t(`share.qrPicture.corners.${value}`)
	}))}
	defaultValue="rounded"
	disabled={!shaping}
	onChange={(qrPictureCorners) => preferences.update({ qrPictureCorners })}
/>
<!-- The code's own squares and corner markers (Trevor, 2026-10-23: "circles or dots"). -->
<SettingSelect
	label={t('share.qrModules')}
	value={preferences.current.qrModules}
	options={QR_MODULES.map((value) => ({ value, label: t(`share.qrModules.${value}`) }))}
	defaultValue="square"
	onChange={(qrModules) => preferences.update({ qrModules })}
/>
<SettingSelect
	label={t('share.qrFinders')}
	value={preferences.current.qrFinders}
	options={QR_FINDERS.map((value) => ({ value, label: t(`share.qrFinders.${value}`) }))}
	defaultValue="square"
	onChange={(qrFinders) => preferences.update({ qrFinders })}
/>
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
		padding-block: var(--space-3) 0;
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

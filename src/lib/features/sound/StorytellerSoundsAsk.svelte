<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { unlockSound } from './sound.ts';
	import { storytellerSounds } from './storyteller-sounds.svelte.ts';
</script>

<!-- Asked on joining a room (Trevor, 2026-11-14, B). Confirm is also the tap a browser needs
     before it plays sound. Closing it with ✕ leaves the question for the next room. -->
<ConfirmDialog
	bind:open={storytellerSounds.asking}
	title={t('settings.storytellerSoundsAsk')}
	onConfirm={() => {
		unlockSound();
		storytellerSounds.set('on');
	}}
	onCancel={() => storytellerSounds.set('off')}
>
	<p class="what">{t('settings.storytellerSoundsWhat')}</p>
</ConfirmDialog>

<style>
	.what {
		margin: 0;
	}
</style>

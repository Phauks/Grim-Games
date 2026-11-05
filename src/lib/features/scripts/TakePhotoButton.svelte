<script lang="ts">
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import PhotoScriptDialog from './PhotoScriptDialog.svelte';
	import { PHOTO_ACCEPT } from './photo-accept.ts';
	import type { ScriptSource } from './saved-scripts.ts';

	/**
	 * Take a Photo (plan M54): opens the camera, reads the printed script on the device and
	 * shows what it read. One button wherever a script is chosen, Add script and /play's
	 * Choose a script included (Trevor, 2026-11-05: easier to find where a players-only game
	 * starts from a picture).
	 */
	interface Props {
		/** Called with the script the photo was read as, once its review is confirmed. */
		onconfirm: (script: LoadedScript, source: ScriptSource) => void;
		/** Called as the photo's review opens, so a dialog the button sits in can close. */
		onopen?: () => void;
		disabled?: boolean;
		variant?: 'solid' | 'quiet';
		/**
		 * False inside a dialog that closes as the photo opens (Add script): the caller shows the
		 * button there and calls `take()`, and the camera input and review stay mounted here.
		 */
		button?: boolean;
	}

	let { onconfirm, onopen, disabled = false, variant = 'solid', button = true }: Props = $props();

	let input: HTMLInputElement | undefined = $state();
	let open = $state(false);
	let dialog: PhotoScriptDialog | undefined = $state();

	/** Opens the camera, or a file picker on a computer. */
	export function take(): void {
		input?.click();
	}

	/** Reads a photo or PDF that arrived another way (Upload File, a dropped file). */
	export function read(file: Blob): void {
		if (!dialog) return;
		onopen?.();
		dialog.reset();
		open = true;
		void dialog.addPhoto(file);
	}

	function onPhoto(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const file = target.files?.[0];
		target.value = '';
		if (file) read(file);
	}
</script>

{#if button}
	<Button icon="photo" {variant} {disabled} onclick={take}>{t('scripts.picker.photo')}</Button>
{/if}
<input
	bind:this={input}
	class="file"
	type="file"
	accept={PHOTO_ACCEPT}
	capture="environment"
	aria-label={t('scripts.picker.photo')}
	aria-hidden="true"
	tabindex="-1"
	data-testid="photo-input"
	onchange={onPhoto}
/>
<PhotoScriptDialog
	bind:this={dialog}
	bind:open
	onconfirm={(script) =>
		onconfirm(script, script.edition ? { kind: 'edition' } : { kind: 'photo' })}
/>

<style>
	.file {
		position: absolute;
		width: 1px; /* px-ok: an offscreen file input, as Add script's */
		height: 1px; /* px-ok: an offscreen file input, as Add script's */
		opacity: 0;
		pointer-events: none;
	}
</style>

<script lang="ts">
	import {
		centredCrop,
		clampCrop,
		cropView,
		MAX_AVATAR_ZOOM,
		panCrop,
		zoomCrop,
		type AvatarCrop,
		type PictureSize
	} from '#lib/core/avatars/crop.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';

	/**
	 * The crop screen for a player's own picture (Trevor, 2026-10-27: "Setting an image as an
	 * avatar needs additional screen so players can identify the exact contours of the picture they
	 * want used"): the picture behind the seat's circle, exactly as the seat will show it. Drag to
	 * move it, pinch or the Zoom slider to make it larger; Save keeps that part.
	 */
	interface Props {
		open?: boolean;
		/** The picture just picked from the device. */
		file?: Blob;
		/** Where the crop starts: the one chosen before, when editing; else the middle. */
		initial?: AvatarCrop;
		onSave: (file: Blob, crop: AvatarCrop) => void;
	}

	let { open = $bindable(false), file, initial, onSave }: Props = $props();

	let url = $state<string>();
	let size = $state<PictureSize>();
	// A new picture starts again: its size comes once it has loaded.
	$effect(() => {
		const made = file && URL.createObjectURL(file);
		url = made;
		size = undefined;
		return () => {
			if (made) URL.revokeObjectURL(made);
		};
	});
	let crop = $state<AvatarCrop>({ zoom: 1, x: 0, y: 0 });
	function loaded(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		size = { width: img.naturalWidth, height: img.naturalHeight };
		crop = initial ? clampCrop(initial, size) : centredCrop(size);
	}
	const view = $derived(size ? cropView(crop, size) : undefined);

	// Each finger on the picture: one drags it, two pinch it.
	let frame = $state<HTMLElement>();
	// Read only in the handlers, never drawn, so a plain Map.
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const fingers = new Map<number, { x: number; y: number }>();
	let pinch: { distance: number; zoom: number } | undefined;
	const spread = () => {
		const [a, b] = [...fingers.values()];
		return Math.hypot(a.x - b.x, a.y - b.y);
	};
	function down(event: PointerEvent) {
		frame?.setPointerCapture(event.pointerId);
		fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		pinch = fingers.size === 2 ? { distance: spread(), zoom: crop.zoom } : undefined;
	}
	function move(event: PointerEvent) {
		const last = fingers.get(event.pointerId);
		if (!last || !size || !frame) return;
		fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
		if (pinch && fingers.size === 2) {
			crop = zoomCrop(crop, size, (pinch.zoom * spread()) / (pinch.distance || 1));
		} else if (fingers.size === 1) {
			const side = frame.clientWidth || 1;
			crop = panCrop(crop, size, (event.clientX - last.x) / side, (event.clientY - last.y) / side);
		}
	}
	function up(event: PointerEvent) {
		fingers.delete(event.pointerId);
		pinch = undefined;
	}

	function save() {
		if (!file || !size) return;
		open = false;
		onSave(file, crop);
	}
</script>

<Dialog bind:open title={t('player.pictureCrop')} description={t('player.pictureCropDetail')}>
	<div class="crop">
		<div
			class="frame"
			bind:this={frame}
			role="img"
			aria-label={t('player.pictureCropArea')}
			data-testid="avatar-crop"
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
		>
			{#if url}<img
					src={url}
					alt=""
					draggable="false"
					onload={loaded}
					style:left="{view?.left ?? 0}%"
					style:top="{view?.top ?? 0}%"
					style:width="{view?.width ?? 100}%"
					style:height="{view?.height ?? 100}%"
				/>{/if}
			<!-- The seat's circle: outside it is shaded, as the seat leaves it out. -->
			<span class="circle"></span>
		</div>
	</div>
	<SettingSlider
		label={t('player.pictureZoom')}
		value={crop.zoom}
		min={1}
		max={MAX_AVATAR_ZOOM}
		step={0.05}
		disabled={!size}
		onChange={(zoom) => size && (crop = zoomCrop(crop, size, zoom))}
	/>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={save}
			disabled={!size}
			confirmLabel={t('common.save')}
		/>
	{/snippet}
</Dialog>

<style>
	.crop {
		display: grid;
		justify-items: center;
		padding: var(--space-2) 0;
	}
	/* Square, as large as the dialog allows on a phone, so the circle's edge is easy to judge. */
	.frame {
		position: relative;
		width: min(100%, calc(18 * var(--u)));
		aspect-ratio: 1;
		overflow: hidden;
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		touch-action: none;
		cursor: grab;
		user-select: none;
		-webkit-touch-callout: none;
	}
	img {
		position: absolute;
		max-width: none;
		pointer-events: none;
	}
	.circle {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		box-shadow: 0 0 0 100vmax var(--backdrop);
		outline: 0.12rem solid var(--on-surface);
		pointer-events: none;
	}
</style>

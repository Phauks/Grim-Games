<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';
	import ScriptQrCenter from './ScriptQrCenter.svelte';
	import type { ShareTarget } from './share-codes.ts';

	/**
	 * Sharing a script's link on the one share screen (`ui/share/SharePanel`). No code to
	 * type: codes are only for joining a game (Trevor, 2026-10-16). The link is made when
	 * this appears (it lives inside a dialog), so nothing is uploaded just by opening a page.
	 */
	interface Props {
		/** Shown in the share sheet and the QR code's name, e.g. the script's name. */
		title: string;
		/** Under the name, when the script says (Trevor, 2026-10-18). */
		author?: string;
		version?: string;
		/**
		 * The script's logo, drawn in the middle of the QR code; without one (or if it fails to
		 * load) the script's name is, in the headings font (Trevor, 2026-10-19).
		 */
		logo?: string;
		/** Makes the link. */
		target: () => Promise<ShareTarget>;
		/**
		 * The live room this device is in: Share then hands on the room's link and join code,
		 * which bring the script with them (Trevor, 2026-10-23: "the QR code, the join code").
		 */
		room?: string;
	}

	let { title, author, version, logo, target, room }: Props = $props();
	const roomLink = $derived(
		room ? `${location.origin}${resolve('/join/[code]', { code: room })}` : undefined
	);
	let logoFailed = $state(false);
	let made = $state.raw<ShareTarget | undefined>();
	let failed = $state(false);
	/**
	 * Offline code (Trevor, 2026-10-26): the script for phones with no internet, read by the
	 * app's own scanner; one code, or an animated one when the script is long. On by itself
	 * when no short link could be made, such as with no internet here.
	 */
	let offline = $state(false);
	let live = true;

	function make() {
		target().then(
			(t) => {
				if (!live) return;
				made = t;
				if (t.fellBack) offline = true;
			},
			(e) => {
				if (live) failed = true;
				reportError(e, { area: 'scripts' });
			}
		);
	}

	onMount(() => {
		// In a room the room's link is shared, so no script link is made (or uploaded) until
		// the offline code is asked for.
		if (!room) make();
		return () => {
			live = false;
		};
	});

	function setOffline(on: boolean) {
		offline = on;
		if (on && !made && !failed) make();
	}

	const offlineCode = $derived(offline ? made?.offline : undefined);
	// `made` is read first, every time: in a room the room's link used to stand in for it, and
	// the offline code then never showed once its link arrived (2026-10-26).
	const url = $derived.by(() => {
		const link = made;
		return offline ? link?.offline?.url : (roomLink ?? link?.url);
	});
</script>

<div class="panel">
	<ScriptByline {author} {version} />
	<SharePanel
		{url}
		{title}
		qrLabel={offline
			? t('scripts.share.offlineQr', { title })
			: room
				? t('room.qrLabel')
				: t('scripts.share.qr', { title })}
		pending={failed ? t('scripts.share.failed') : t('scripts.share.making')}
		code={room ? { label: t('room.joinCode'), value: formatRoomCode(room) } : undefined}
		text={room && !offline ? t('room.shareText', { code: formatRoomCode(room) }) : undefined}
		qrCenterShape={logo && !logoFailed ? 'square' : 'wide'}
		qrCaption={offline ? t('scripts.share.offlineCaption') : undefined}
		frames={offlineCode?.frames}
		plain={offline}
	>
		{#snippet qrCenter()}
			<ScriptQrCenter {logo} name={title} bind:failed={logoFailed} />
		{/snippet}
		{#snippet actions()}
			<div class="offline">
				<Toggle
					label={t('scripts.share.offline')}
					description={t('scripts.share.offlineDescription')}
					checked={offline}
					onChange={setOffline}
				/>
			</div>
		{/snippet}
	</SharePanel>
</div>

<style>
	.panel {
		margin-top: var(--space-3);
	}
	.offline {
		flex: 1;
	}
</style>

<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { roomJoinLink } from '#lib/features/room/join-link.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import SharePanel from '#lib/ui/share/SharePanel.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';
	import ScriptLogo from './ScriptLogo.svelte';
	import ScriptQrCenter from './ScriptQrCenter.svelte';
	import type { ShareTarget } from './share-codes.ts';
	import { withOfflineRoom } from './share.ts';
	import { keepScreenAwake } from '#lib/features/day/timer-wake-lock.ts';
	import InviteFriends from '#lib/features/friends/InviteFriends.svelte';
	import ScriptFriendsShare from '#lib/features/friends/ScriptFriendsShare.svelte';

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
		/**
		 * The Storyteller's Share (`room/RoomPanel`): the room's link and code even while the
		 * room is still opening, so this is the one share screen on both sides (Trevor,
		 * 2026-10-27: "Storyteller should have everything player screen has").
		 */
		hosting?: {
			/** Shown in the QR's place until the room's code arrives. */
			pending: string;
			/** Sent before the link by Share and Copy, e.g. the game's line and the code. */
			text?: string;
			/** Replaces the room's code (`ui/share/SharePanel`'s `refresh`). */
			refresh?: { label: string; onclick: () => void; disabled?: boolean };
		};
	}

	let { title, author, version, logo, target, room, hosting }: Props = $props();
	/** The room's link and code are shared rather than the script's. */
	const inRoom = $derived(!!room || !!hosting);
	const roomLink = $derived(room ? roomJoinLink(room) : undefined);
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
		if (!inRoom) make();
		return () => {
			live = false;
		};
	});

	function setOffline(on: boolean) {
		offline = on;
		if (on && !made && !failed) make();
	}

	/** The offline code names the live room, so phones can join it once they have internet. */
	const offlineCode = $derived(
		offline && made?.offline ? withOfflineRoom(made.offline, room) : undefined
	);
	// An animated code takes a while to read: the screen stays on while it shows (2026-10-27).
	$effect(() => {
		if (!offlineCode?.frames) return;
		keepScreenAwake(true, 'offline-code');
		return () => keepScreenAwake(false, 'offline-code');
	});
	// `made` is read first, every time: in a room the room's link used to stand in for it, and
	// the offline code then never showed once its link arrived (2026-10-26).
	const url = $derived.by(() => {
		const link = made;
		return offline ? offlineCode?.url : inRoom ? roomLink : link?.url;
	});
</script>

<div class="panel">
	<!-- The script under the screen's "Share" title, as /play's header shows it: logo, name,
	     then author and version (Trevor, 2026-10-27). -->
	<div class="script" data-testid="share-script">
		<h3 class="name">
			{#if logo && !logoFailed}<ScriptLogo
					src={logo}
					class="title-logo"
					onfail={() => (logoFailed = true)}
				/>{/if}<span>{title}</span>
		</h3>
		<ScriptByline {author} {version} inline />
	</div>
	<SharePanel
		{url}
		{title}
		qrLabel={offline
			? t('scripts.share.offlineQr', { title })
			: inRoom
				? t('room.qrLabel')
				: t('scripts.share.qr', { title })}
		pending={offline || !hosting
			? failed
				? t('scripts.share.failed')
				: t('scripts.share.making')
			: hosting.pending}
		code={inRoom ? { label: t('room.joinCode'), value: room && formatRoomCode(room) } : undefined}
		text={room && !offline
			? (hosting?.text ?? t('room.shareText', { code: formatRoomCode(room) }))
			: undefined}
		refresh={hosting?.refresh && {
			...hosting.refresh,
			disabled: offline || hosting.refresh.disabled
		}}
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
	<!-- Friends and the profile get the script itself, not a room (plan F9, F10). -->
	{#if !inRoom}<ScriptFriendsShare name={title} hash={made?.lasting} />{/if}
	<!-- The Storyteller invites friends to the room (plan F4); kept in place until it opens. -->
	{#if hosting}<InviteFriends code={room} {title} />{/if}
</div>

<style>
	.panel {
		margin-top: var(--space-3);
	}
	.script {
		display: grid;
		gap: var(--space-1);
		margin-bottom: var(--space-3);
	}
	.name {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-width: 0;
		margin: 0;
		font-size: var(--page-title-size);
		overflow-wrap: break-word;
	}
	.name > span {
		min-width: 0;
	}
	.offline {
		flex: 1;
	}
</style>

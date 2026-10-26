<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { normaliseRoomCode } from '#lib/core/sync/room-code.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { RoomViewer, viewerKeyFrom } from './viewer.svelte.ts';
	import SharedBoard from './SharedBoard.svelte';

	/**
	 * The view-only grimoire link (Specters, Trevor 2026-10-18): the Storyteller's whole
	 * grimoire, live, for spectators. Each time it opens, the viewer first promises not to
	 * spoil the game; only then does it connect.
	 */
	interface Props {
		code: string;
	}

	let { code }: Props = $props();

	const room = $derived(normaliseRoomCode(code));
	let key = $state<string>();
	let pledgeOpen = $state(false);
	let viewer = $state.raw<RoomViewer>();
	let ready = $state(false);
	let problem = $state<string>();

	onMount(() => {
		key = viewerKeyFrom(location.hash);
		pledgeOpen = !!room && !!key;
		return () => viewer?.stop();
	});

	function watch() {
		if (room && key) viewer = new RoomViewer(room, key);
	}

	const message = $derived(
		!room || key === undefined
			? t('room.watch.badLink')
			: viewer?.refusedReason === 'not-viewer'
				? // Opened from Join game with a typed password, rather than the link.
					page.state.password
					? t('room.watch.wrongPassword')
					: t('room.watch.turnedOff')
				: viewer?.refusedReason === 'too-many-tries'
					? t('room.watch.tooManyTries')
					: viewer?.refusedReason === 'too-old'
						? t('room.tooOld')
						: viewer?.status === 'refused' || viewer?.status === 'closed'
							? t('room.closedOrWrong')
							: problem
	);
	// A link turned off, or a room closed, takes the grimoire away at once.
	const showBoard = $derived(
		!message && viewer?.status !== 'refused' && viewer?.status !== 'closed'
	);
</script>

{#if showBoard}<SharedBoard
		shared={viewer?.grimoire}
		onReady={(r) => (ready = r)}
		onProblem={(p) => (problem = p)}
	/>{/if}
{#if !(showBoard && ready)}
	<main class="message" data-testid="watch-status">
		<h1>{t('room.watch.title')}</h1>
		<p role={message ? 'alert' : 'status'}>
			{message ??
				(viewer
					? viewer.status === 'offline'
						? t('room.playerOffline')
						: t('room.watch.waiting')
					: '')}
		</p>
		<Button href={resolve('/')} icon="back" data-way-back>{t('room.watch.home')}</Button>
	</main>
{/if}

<ConfirmDialog
	bind:open={pledgeOpen}
	title={t('room.watch.pledgeTitle')}
	onConfirm={watch}
	onCancel={() => void goto(resolve('/'))}
>
	<p class="pledge-lead">{t('room.watch.pledgeLead')}</p>
	<ul class="pledge" data-testid="watch-pledge">
		<li>{t('room.watch.pledgeCheat')}</li>
		<li>{t('room.watch.pledgeShare')}</li>
		<li>{t('room.watch.pledgeIntegrity')}</li>
	</ul>
</ConfirmDialog>

<style>
	.message {
		display: grid;
		justify-items: start;
		gap: var(--space-3);
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
	.message h1,
	.message p {
		margin: 0;
	}
	.pledge-lead {
		margin: 0;
	}
	.pledge {
		margin: var(--space-2) 0 0;
		padding-left: 1.25em;
	}
</style>

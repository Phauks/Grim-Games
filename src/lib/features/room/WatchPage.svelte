<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { migrateSavedGame, SavedGameError } from '#lib/core/engine/index.ts';
	import { normaliseRoomCode } from '#lib/core/sync/room-code.ts';
	import type { SharedGrimoire } from '#lib/core/sync/room.ts';
	import { provideCharacters } from '#lib/features/characters/character-context.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { errorMessage } from '#lib/features/errors/app-error.ts';
	import ErrorBoundary from '#lib/features/errors/ErrorBoundary.svelte';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { parseReminderCopyIds, parseReminderSpots } from '#lib/features/grimoire/device-notes.ts';
	import { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import GrimoireBoard from '#lib/features/grimoire/GrimoireBoard.svelte';
	import { parseSeatLayout } from '#lib/ui/seating/seat-layout.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import { RoomViewer, viewerKeyFrom } from './viewer.svelte.ts';

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
	let board = $state.raw<Grimoire>();
	let problem = $state<string>();

	onMount(() => {
		key = viewerKeyFrom(location.hash);
		pledgeOpen = !!room && !!key;
		return () => viewer?.stop();
	});

	provideCharacters(() => board?.open.characters);

	function watch() {
		if (room && key) viewer = new RoomViewer(room, key);
	}

	$effect(() => {
		const shared = viewer?.grimoire;
		if (shared) void show(shared);
	});

	async function show(shared: SharedGrimoire) {
		try {
			const saved = migrateSavedGame(shared.saved);
			const data = await loadOfficialData();
			if (viewer?.grimoire !== shared) return;
			let next = board;
			if (!next || next.game.gameId !== saved.gameId || !next.open.follow(saved)) {
				next = new Grimoire(OpenGame.watch(data, saved));
			}
			next.layout = parseSeatLayout(shared.layout);
			next.reminderSpots = parseReminderSpots(shared.reminderSpots);
			next.copies = parseReminderCopyIds(shared.copies);
			board = next;
			problem = undefined;
		} catch (e) {
			problem =
				e instanceof SavedGameError && e.problem === 'too-new'
					? t('common.gameTooNew')
					: errorMessage(e);
		}
	}

	const message = $derived(
		!room || key === undefined
			? t('room.watch.badLink')
			: viewer?.refusedReason === 'not-viewer'
				? t('room.watch.turnedOff')
				: viewer?.refusedReason === 'too-old'
					? t('room.tooOld')
					: viewer?.status === 'refused' || viewer?.status === 'closed'
						? t('room.closedOrWrong')
						: problem
	);
	// A link turned off, or a room closed, takes the grimoire away at once.
	const showBoard = $derived(
		board && !message && viewer?.status !== 'refused' && viewer?.status !== 'closed'
	);
</script>

{#if showBoard && board}
	<ErrorBoundary area="grimoire">
		<GrimoireBoard grimoire={board} watching />
	</ErrorBoundary>
{:else}
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
		<Button href={resolve('/')} icon="back">{t('room.watch.home')}</Button>
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

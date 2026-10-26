<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { fromScript, type LoadedScript } from '#lib/core/data/index.ts';
	import { normaliseRoomCode } from '#lib/core/sync/room-code.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { keepScreenAwake } from '#lib/features/day/timer-wake-lock.ts';
	import PlayerGrim from '#lib/features/player/PlayerGrim.svelte';
	import NavMenuButton from '#lib/features/shell/NavMenuButton.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { RoomTown } from './town.svelte.ts';

	/**
	 * Public Town (Trevor, 2026-10-26): a tablet in the middle of the table showing the
	 * players' grim, and that is it. It opens with the room's code alone, as a phone joins,
	 * but is no player: nothing on it can be tapped, it keeps nothing of its own, and the room
	 * sends it only what every phone already has. The screen stays on while it shows.
	 */
	interface Props {
		code: string;
	}

	let { code }: Props = $props();

	const room = $derived(normaliseRoomCode(code));
	let town = $state.raw<RoomTown>();
	let script = $state.raw<LoadedScript>();

	onMount(() => {
		if (room) town = new RoomTown(room);
		keepScreenAwake(true);
		return () => {
			keepScreenAwake(false);
			town?.stop();
		};
	});

	// The room's script draws the Travellers and the corner. It is loaded here only, and never
	// becomes this device's current script, as a phone's does.
	$effect(() => {
		const sent = town?.script;
		if (!sent) return;
		let cancelled = false;
		void loadOfficialData()
			.then((data) => {
				const { script: loaded } = fromScript(sent, data);
				if (!cancelled && loaded.characters.length > 0) script = loaded;
			})
			.catch(() => {});
		return () => (cancelled = true);
	});

	const status = $derived(town?.status);
	const message = $derived(
		!room
			? t('room.notACode')
			: town?.refusedReason === 'too-old'
				? t('room.tooOld')
				: status === 'refused' || status === 'closed'
					? t('room.closedOrWrong')
					: undefined
	);
	const table = $derived(town?.view?.public);
	const showTown = $derived(!message && !!script && !!table?.seats.length);
</script>

<main class="town-page" data-testid="public-town">
	<!-- The app's menu, top left as on every screen; the rest is the town. -->
	<div class="bar">
		<NavMenuButton />
		<h1>{t('room.town.title')}</h1>
	</div>
	{#if showTown && script && table && room}
		<div class="board">
			<PlayerGrim
				{script}
				display
				town={{
					seats: table.seats,
					layout: table.layout,
					storytellerName: table.storytellerName,
					corner: table.corner,
					roomCode: room
				}}
			/>
		</div>
	{:else}
		<div class="message" data-testid="town-status">
			<p role={message ? 'alert' : 'status'}>
				{message ?? (status === 'offline' ? t('room.playerOffline') : t('room.town.waiting'))}
			</p>
			{#if message}<Button href={resolve('/join')}>{t('room.joinTitle')}</Button>{/if}
		</div>
	{/if}
</main>

<style>
	/* The whole screen: a slim bar for the menu, and the town under it. */
	.town-page {
		display: flex;
		flex-direction: column;
		height: calc(100dvh - var(--app-top) - env(safe-area-inset-bottom));
	}
	.bar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		padding: var(--menu-inset);
	}
	.bar h1 {
		margin: 0;
		font-size: 1.1rem;
	}
	.board {
		position: relative;
		flex: 1;
		min-height: 0;
	}
	.message {
		display: grid;
		justify-items: start;
		gap: var(--space-3);
		max-width: calc(40 * var(--u));
		margin: 0 auto;
		padding: var(--space-5) var(--space-4);
	}
	.message p {
		margin: 0;
	}
</style>

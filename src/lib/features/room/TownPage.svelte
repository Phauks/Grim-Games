<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import { fromScript, type LoadedScript } from '#lib/core/data/index.ts';
	import { scriptLogo } from '#lib/core/data/script-logo.ts';
	import { normaliseRoomCode } from '#lib/core/sync/room-code.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { keepScreenAwake } from '#lib/features/day/timer-wake-lock.ts';
	import PlayerGrim from '#lib/features/player/PlayerGrim.svelte';
	import PlayerScriptActions from '#lib/features/player/PlayerScriptActions.svelte';
	import ScriptByline from '#lib/features/player/ScriptByline.svelte';
	import { playerSettings } from '#lib/features/player/player-settings.svelte.ts';
	import { scriptVersion } from '#lib/features/player/player-script.ts';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import { scriptShareable } from '#lib/features/scripts/share-codes.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import FullScreenButton from '#lib/ui/primitives/FullScreenButton.svelte';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import { screenTheme } from '#lib/ui/themes/screen-theme.svelte.ts';
	import { sheetTheme } from '#lib/ui/themes/sheet-backgrounds.ts';
	import { forgetRoom } from './player.svelte.ts';
	import { rememberRoom } from './recent-rooms.ts';
	import { RoomTown } from './town.svelte.ts';

	/**
	 * Public Town (Trevor, 2026-10-26): a tablet in the middle of the table showing the
	 * players' grim. It is the player screen's Grim, top of the app and corner alike (Trevor:
	 * "same as storyteller/player shared grim"), except that it sets no guesses or notes. It
	 * opens with the room's code alone, as a phone joins, but is no player: the room sends it
	 * only what every phone already has. The screen stays on while it shows.
	 */
	interface Props {
		code: string;
	}

	let { code }: Props = $props();

	const room = $derived(normaliseRoomCode(code));
	let town = $state.raw<RoomTown>();
	let script = $state.raw<LoadedScript>();

	onMount(() => {
		if (room) {
			town = new RoomTown(room);
			// Your games on Join game opens it here again (Trevor, 2026-10-26).
			rememberRoom(room, undefined, true);
		}
		keepScreenAwake(true);
		return () => {
			keepScreenAwake(false);
			town?.stop();
		};
	});

	// The player screen's background, as on /play (Trevor, 2026-10-25).
	$effect.pre(() => {
		screenTheme.current = sheetTheme(playerSettings.current.sheetBackground, preferences.theme);
		return () => {
			screenTheme.current = undefined;
		};
	});

	// The room's script draws the title, the Travellers and the corner. It is loaded here only,
	// and never becomes this device's current script, as a phone's does.
	$effect(() => {
		const sent = town?.script;
		if (!sent) return;
		let cancelled = false;
		void loadOfficialData()
			.then((data) => {
				const { script: loaded } = fromScript(sent, data);
				if (cancelled || loaded.characters.length === 0) return;
				script = loaded;
				if (room) rememberRoom(room, loaded.name, true);
			})
			.catch(() => {});
		return () => (cancelled = true);
	});

	const logo = $derived(script && scriptLogo(script));
	let logoFailed = $state(false);
	$effect(() => {
		void logo;
		logoFailed = false;
	});
	const version = $derived(scriptVersion(undefined, script?.meta));
	const shareable = $derived(script && scriptShareable(script, undefined));

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
	// A closed room leaves Your games, as it does for a phone.
	$effect(() => {
		if (room && (status === 'refused' || status === 'closed')) forgetRoom(room);
	});
	const table = $derived(town?.view?.public);
	const showTown = $derived(!message && !!script && !!table?.seats.length);

	// Full screen shows the town alone, not the app (Trevor, 2026-10-26).
	let stage = $state<HTMLDivElement>();
</script>

<!-- The player screen's title line: the script's logo and name, its byline, Print and Share. -->
<Page title={script?.name ?? t('room.town.title')} iconActions>
	{#snippet lead()}
		{#if logo && !logoFailed}<ScriptLogo
				src={logo}
				class="title-logo"
				onfail={() => (logoFailed = true)}
			/>{/if}
	{/snippet}
	{#snippet actions()}
		{#if script}<PlayerScriptActions
				{script}
				{version}
				share={shareable}
				room={room ?? undefined}
			/>{/if}
	{/snippet}
	{#snippet subtitle()}
		<ScriptByline
			author={script?.meta.author}
			{version}
			storyteller={table?.storytellerName?.trim() || undefined}
			inline
		/>&nbsp;
	{/snippet}

	<div class="stage" bind:this={stage} data-testid="public-town">
		{#if showTown && script && table && room}
			<!-- In the town's own top right corner, in and out of full screen (Trevor, 2026-10-26:
			     "supposed to be in the town square, and makes it so the townsquare takes up the
			     whole screen"); the board's corner lines are top left. -->
			{#if stage}<div class="full-screen"><FullScreenButton target={stage} /></div>{/if}
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
		{:else}
			<div class="message" data-testid="town-status">
				<p role={message ? 'alert' : 'status'}>
					{message ?? (status === 'offline' ? t('room.playerOffline') : t('room.town.waiting'))}
				</p>
				{#if message}<Button href={resolve('/join')}>{t('room.joinTitle')}</Button>{/if}
			</div>
		{/if}
	</div>
</Page>

<style>
	/* Beside the name in the title, as on /play. */
	:global(.title-logo) {
		flex: none;
		width: 1.8em;
		height: 1.8em;
	}
	/* The town's top right corner holds full screen. In full screen the town fills the screen,
	   on the page's own background. */
	.stage {
		position: relative;
	}
	.stage:fullscreen {
		background: var(--surface);
	}
	.stage:fullscreen :global([data-testid='player-grim']) {
		height: 100dvh;
		border-radius: 0;
	}
	.full-screen {
		position: absolute;
		top: var(--space-2);
		right: var(--space-2);
		z-index: 1;
		border-radius: 50%;
		background: var(--board-bar-background);
	}
	.message {
		display: grid;
		justify-items: start;
		gap: var(--space-3);
	}
	.message p {
		margin: 0;
	}
</style>

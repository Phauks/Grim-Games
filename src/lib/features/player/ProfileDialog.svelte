<script lang="ts">
	import { onMount } from 'svelte';
	import { DEFAULT_FRAME, FRAME_REACH, seatFrame } from '#lib/core/frames/index.ts';
	import { HistorySummary } from '#lib/features/history/history-summary.svelte.ts';
	import PlayerNameRow from '#lib/features/room/PlayerNameRow.svelte';
	import { joinedRoom } from '#lib/features/room/joined-room.svelte.ts';
	import { savedPlayerName } from '#lib/features/room/player.svelte.ts';
	import FairPlayNotice from '#lib/features/show/FairPlayNotice.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import StatCards from '#lib/ui/layout/StatCards.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import AvatarFace from '#lib/ui/seating/AvatarFace.svelte';
	import SeatDisc from '#lib/ui/seating/SeatDisc.svelte';
	import SettingFrame from '#lib/ui/settings/SettingFrame.svelte';
	import { avatarPicture } from './avatar-picture.svelte.ts';
	import AvatarPictureRow from './AvatarPictureRow.svelte';
	import CharacterIconRow from './CharacterIconRow.svelte';
	import FlavourTextRow from './FlavourTextRow.svelte';
	import ProfileDetailsRows from './ProfileDetailsRows.svelte';
	import { playerSettings } from './player-settings.svelte.ts';
	import { profileDialog } from './profile-dialog.svelte.ts';

	/**
	 * The player's Profile (Trevor, 2026-10-27): who they are at every table, apart from how
	 * their screen looks. Its own dialog since 2026-11-15 (option E): their seat as others see
	 * it stays pinned, at the top on a phone or in its own column on a wide screen, while every
	 * laurel, colour and motion shows as a tile below it, in groups that fold.
	 */
	const name = $derived(joinedRoom.player?.view?.me.name ?? savedPlayerName());
	const frame = $derived(seatFrame(playerSettings.current.frame));

	// History's counts beside the seat on a wide screen (Home's card shows them on a phone).
	const history = new HistorySummary();
	onMount(() => history.load());

	// Tapping the seat shows it large, over the Profile (Trevor, 2026-10-28), so nothing moves.
	let enlarged = $state(false);
	let paneWidth = $state(0);
	let bigWidth = $state(0);
	let screenHeight = $state(0);

	/**
	 * The room a seat shown by itself needs round it, as a share of its size, so the widest
	 * laurel at the height of a pulse and the name never run into the text below (Trevor,
	 * 2026-11-03). The same for every frame, so picking one moves nothing.
	 */
	const PULSE = 1.05; // FrameDrawing's largest motion scale
	const ROOM = (0.5 + FRAME_REACH) * PULSE - 0.5;
	const room = (size: number) => `${ROOM * size}px`;

	/** Wide enough for the seat's own column beside the choices. */
	const wide = $derived(paneWidth > 640);
	// Small enough on a phone that the choices keep most of the screen below it.
	const seatSize = $derived(
		wide
			? Math.min((paneWidth * 0.36) / (1 + 2 * ROOM), screenHeight * 0.3)
			: Math.min((paneWidth * 0.36) / (1 + 2 * ROOM), screenHeight * 0.14)
	);
	const bigSize = $derived(
		Math.max(0, Math.min((bigWidth * 0.95) / (1 + 2 * ROOM), (screenHeight * 0.6) / (1 + 2 * ROOM)))
	);
</script>

<svelte:window bind:innerHeight={screenHeight} />

{#snippet seat(size: number)}
	<SeatDisc
		{size}
		{name}
		number={1}
		avatar={playerSettings.current.avatar}
		picture={avatarPicture.url}
		{frame}
	/>
{/snippet}

{#snippet face()}
	<AvatarFace avatar={playerSettings.current.avatar} {name} picture={avatarPicture.url} />
{/snippet}

<Dialog bind:open={profileDialog.open} title={t('player.profile')} size="wide">
	<div class="layout" class:wide bind:clientWidth={paneWidth} data-testid="profile">
		<div class="pinned">
			<button
				type="button"
				class="enlarge"
				aria-label={t('player.bigPreview')}
				data-testid="profile-preview"
				style:padding={room(seatSize)}
				onclick={() => (enlarged = true)}
				>{#if seatSize}{@render seat(seatSize)}{/if}</button
			>
			{#if wide}
				<!-- Everyone at the table sees this look, so it mustn't hint at a character
				     (Trevor, 2026-10-29: a warning, not a lock). -->
				<FairPlayNotice kind="profile" />
				<StatCards stats={history.counts} testid="profile-stats" />
			{/if}
		</div>
		<div class="choices">
			{#if !wide}<FairPlayNotice kind="profile" />{/if}
			<!-- The laurel round this player's seat token, sent with their initials (L4, A1). -->
			<SettingFrame
				label={t('player.frame')}
				colourLabel={t('player.frameColour')}
				motionLabel={t('player.frameMotion')}
				value={playerSettings.current.frame ?? DEFAULT_FRAME}
				defaultValue={DEFAULT_FRAME}
				onChange={(next) =>
					playerSettings.update({ frame: next === DEFAULT_FRAME ? undefined : next })}
				{face}
				testid="player-frame-setting"
			/>
			<!-- The player's own picture on their seat (2026-10-27). -->
			<AvatarPictureRow {name} />
			<!-- This phone's name: in its room while it is in one, else kept for the next (Trevor,
			     2026-10-28: the Profile is where the player name is set). -->
			<PlayerNameRow player={joinedRoom.player} />
			<!-- A line about themselves, their tag-line on their profile (2026-10-28, 2026-11-01). -->
			<FlavourTextRow />
			<!-- The character that represents them, in their Profile only (Trevor, 2026-10-28; off
			     the board, 2026-11-03). -->
			<CharacterIconRow />
			<!-- Their own details, such as "Favorite script", all optional (Trevor, 2026-11-01).
			     Last, so adding one moves nothing above it. -->
			<ProfileDetailsRows />
		</div>
	</div>
</Dialog>

<Dialog bind:open={enlarged} title={t('player.bigPreview')} size="wide">
	<div class="big" bind:clientWidth={bigWidth} data-testid="profile-big-preview">
		{#if bigSize}<span style:padding={room(bigSize)}>{@render seat(bigSize)}</span>{/if}
	</div>
</Dialog>

<style>
	.layout {
		display: grid;
		gap: var(--space-3);
	}
	.layout.wide {
		grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
		align-items: start;
	}
	/* The seat stays in view while the choices scroll under it: held at the dialog's own top,
	   over the dialog's padding, in the dialog's colour. */
	.pinned {
		position: sticky;
		top: calc(-1 * var(--space-4));
		z-index: var(--z-pinned-bar);
		display: grid;
		justify-items: center;
		gap: var(--space-3);
		margin-block-start: calc(
			-1 * var(--space-4)
		); /* overlap-ok: over the dialog's own top padding, so the pinned seat covers what scrolls under it */
		padding-block: var(--space-4) var(--space-2);
		border-bottom: var(--control-border);
		background: var(--dialog-background);
	}
	.wide .pinned {
		border-bottom: 0;
	}
	.choices {
		display: grid;
		min-width: 0;
	}
	.enlarge {
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: none;
		color: inherit;
		cursor: zoom-in;
	}
	.big {
		display: grid;
		justify-items: center;
		padding-block: var(--space-3);
	}
</style>

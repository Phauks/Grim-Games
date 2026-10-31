<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ScriptMeta } from '#lib/core/data/index.ts';
	import { gameClock } from '#lib/core/rules/index.ts';
	import type { PublicCorner, PublicStoryteller } from '#lib/core/sync/public-projection.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import { phaseText } from '#lib/features/grimoire/phase-text.ts';
	import StorytellerProfile from '#lib/features/player/StorytellerProfile.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import GameInfoSheet, { type GameInfoRow } from './GameInfoSheet.svelte';

	/**
	 * Game info on a player's grim, from its corner's script name (Trevor, 2026-10-30): what the
	 * Storyteller's board sends the town, a row each, as the Storyteller's own Game info shows
	 * it. The Storyteller's name opens their profile, so a player can add them as a friend.
	 */
	interface Props {
		/** The corner name, which opens it; without it, a dialog opened by `open` (the grim's ⓘ). */
		children?: Snippet;
		open?: boolean;
		meta: ScriptMeta;
		storytellerName?: string;
		/** The Storyteller's avatar, laurel and picture, for their profile as a player's shows. */
		storyteller?: PublicStoryteller;
		corner?: PublicCorner;
		/** The live room this phone is in; without it the Storyteller's name opens nothing. */
		roomCode?: string;
	}

	let {
		children,
		open = $bindable(false),
		meta,
		storytellerName,
		storyteller,
		corner,
		roomCode
	}: Props = $props();
	let profileOpen = $state(false);

	/** Game time ticks while it is open, as the corner's does. */
	let clockNow = $state(Date.now());
	const clock = $derived(corner?.gameTime);
	$effect(() => {
		if (!open || !clock?.begun || clock.endedAt !== undefined) return;
		clockNow = Date.now();
		const tick = setInterval(() => (clockNow = Date.now()), 1000);
		return () => clearInterval(tick);
	});
	// 0:00 until the first night, as on the corner: Game phase says Setup.
	const gameTime = $derived(
		!clock
			? undefined
			: !clock.begun
				? gameClock.formatGameLength(0)
				: clock.startedAt === undefined
					? undefined
					: gameClock.formatGameLength(
							gameClock.gameLength(
								clock.startedAt,
								Math.max(clockNow, clock.startedAt),
								clock.endedAt
							)
						)
	);

	const rows = $derived<GameInfoRow[]>([
		{ key: 'script', label: t('modes.info.script'), value: meta.name },
		{ key: 'author', label: t('modes.info.author'), value: meta.author },
		{ key: 'version', label: t('modes.info.version'), value: corner?.version },
		{
			key: 'storyteller',
			label: t('modes.info.storyteller'),
			value: storytellerName,
			...(roomCode ? { action: () => (profileOpen = true), actionTestId: 'info-storyteller' } : {})
		},
		{ key: 'players', label: t('modes.info.players'), value: corner?.players },
		{ key: 'rules', label: t('modes.info.rules'), value: corner?.modes.join(', ') },
		{
			key: 'join-code',
			label: t('room.joinCode'),
			value: roomCode ? formatRoomCode(roomCode) : undefined
		},
		{
			key: 'phase',
			label: t('modes.info.phase'),
			value: corner?.phase ? phaseText(corner.phase) : undefined
		},
		{ key: 'game-time', label: t('history.gameLength'), value: gameTime }
	]);
</script>

<GameInfoSheet bind:open {rows} {children} />
{#if roomCode}<StorytellerProfile
		bind:open={profileOpen}
		name={storytellerName}
		look={storyteller}
		{roomCode}
	/>{/if}

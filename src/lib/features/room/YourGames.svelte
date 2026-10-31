<script lang="ts">
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import ScriptName from '#lib/features/scripts/ScriptName.svelte';
	import { forgetRoom } from './player.svelte.ts';
	import { fetchRoomPreview, type GamePreview } from './room-preview.ts';
	import { recentRooms } from './recent-rooms.ts';

	/**
	 * Join game's "As player": the rooms this phone joined, newest first, each with its script,
	 * Storyteller and when this phone last opened it (Trevor, 2026-10-19 and 2026-10-23), above
	 * the games it is storytelling (Trevor, 2026-10-28). A room found closed leaves the list
	 * at once; what happened in it is in History (Trevor, 2026-10-29).
	 */
	interface Props {
		/** A room was tapped: `town` when this device last opened it as a Public Town display. */
		onOpen: (code: string, town: boolean) => void;
	}

	let { onOpen }: Props = $props();

	// When this phone last opened each of its games, as Resume game dates saved games.
	const lastSeen = $derived(
		new Intl.DateTimeFormat(locale.current, { dateStyle: 'medium', timeStyle: 'short' })
	);
	// The rooms this phone joined, read once so the list keeps its rows while each is looked up.
	const recent = recentRooms();
	let recentGames = $state<Record<string, GamePreview | null>>({});
	$effect(() => {
		if (recent.length === 0) return;
		const abort = new AbortController();
		for (const room of recent) {
			fetchRoomPreview(room.code, abort.signal).then(
				(game) => {
					recentGames = { ...recentGames, [room.code]: game ?? null };
					if (!game) forgetRoom(room.code);
				},
				() => {}
			);
		}
		return () => abort.abort();
	});
	const shown = $derived(recent.filter((room) => recentGames[room.code] !== null));
</script>

<!-- Opens and closes from its heading (Trevor, 2026-10-28). -->
<PageSection
	title={t('room.asPlayer')}
	collapsible
	storageKey="continue.as-player"
	count={shown.length}
>
	{#if shown.length === 0}
		<p class="none">{t('common.none')}</p>
	{:else}
		<ul class="recent" data-testid="recent-rooms">
			{#each shown as room (room.code)}
				{@const game = recentGames[room.code]}
				<li>
					<button type="button" class="recent-game" onclick={() => onOpen(room.code, !!room.town)}>
						<ScriptName
							name={game?.name ?? room.script}
							logo={game?.logo}
							empty={t('room.noScriptYet')}
						>
							{#snippet sub()}<span class="recent-line"
									>{game?.storyteller
										? t('room.recentLine', {
												code: formatRoomCode(room.code),
												name: game.storyteller
											})
										: formatRoomCode(room.code)}</span
								>
								<!-- Its own line, so a phone shows all of it (Trevor, 2026-10-26). -->
								<span class="recent-line"
									>{lastSeen.format(room.at)}{room.town ? ` · ${t('room.town.title')}` : ''}</span
								>{/snippet}
						</ScriptName>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</PageSection>

<style>
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.recent {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Three lines always, so a room's details arriving move nothing. */
	.recent-game {
		display: flex;
		align-items: center;
		box-sizing: border-box;
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.recent-line {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>

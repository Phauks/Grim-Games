<script lang="ts">
	import { locale, t } from '#lib/i18n/locale.svelte.ts';
	import { formatRoomCode } from '#lib/core/sync/room-code.ts';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';
	import { forgetRoom } from './player.svelte.ts';
	import { fetchRoomPreview, type GamePreview } from './room-preview.ts';
	import { recentRooms } from './recent-rooms.ts';

	/**
	 * Join game's "Your games": the rooms this phone joined, newest first, each with its script,
	 * Storyteller and when this phone last opened it (Trevor, 2026-10-19 and 2026-10-23). A room
	 * found closed leaves the list.
	 */
	interface Props {
		/** A room was tapped. */
		onOpen: (code: string) => void;
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
</script>

{#if recent.length > 0}
	<PageSection title={t('room.yourGames')}>
		<ul class="recent" data-testid="recent-rooms">
			{#each recent as room (room.code)}
				{@const game = recentGames[room.code]}
				<li>
					<button
						type="button"
						class="recent-game"
						disabled={game === null}
						onclick={() => onOpen(room.code)}
					>
						<ScriptLogo src={game?.logo} name={game?.name ?? room.script} class="recent-logo" />
						<span class="recent-text">
							<span class="recent-name">{(game?.name ?? room.script) || t('room.noScriptYet')}</span
							>
							<span class="recent-line"
								>{game === null
									? t('room.recentClosed', { code: formatRoomCode(room.code) })
									: game?.storyteller
										? t('room.recentLine', {
												code: formatRoomCode(room.code),
												name: game.storyteller
											})
										: formatRoomCode(room.code)}
								· {lastSeen.format(room.at)}</span
							>
						</span>
					</button>
				</li>
			{/each}
		</ul>
	</PageSection>
{/if}

<style>
	.recent {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Two lines always, so a room's details arriving move nothing. */
	.recent-game {
		display: grid;
		grid-template-columns: calc(2.5 * var(--u)) minmax(0, 1fr);
		align-items: center;
		gap: var(--space-3);
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
	.recent-game:disabled {
		cursor: default;
		opacity: 0.55;
	}
	.recent-game :global(.recent-logo) {
		width: calc(2.5 * var(--u));
		height: calc(2.5 * var(--u));
	}
	.recent-text {
		display: grid;
		min-width: 0;
	}
	.recent-name,
	.recent-line {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.recent-name {
		font-family: var(--font-heading);
		font-weight: var(--font-heading-weight);
	}
	.recent-line {
		color: var(--on-surface-muted);
	}
</style>

<script lang="ts">
	import { resolve } from '$app/paths';
	import type { GameId, SeatId } from '#lib/core/model/index.ts';
	import { seatNumber } from '#lib/core/model/index.ts';
	import { STANDARD, type DayStep } from '#lib/core/modes/index.ts';
	import type { VoteTally } from '#lib/core/sync/room.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { attachRoom, roomHost } from '#lib/features/room/host.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ModeInspectDialog from './ModeInspectDialog.svelte';
	import ModeValue from './ModeValue.svelte';
	import { findMode } from './custom-modes.svelte.ts';
	import { readGameMode } from './game-mode-store.ts';

	/**
	 * The spectators' shared ability of a mode like Specters
	 * (https://www.youtube.com/watch?v=-R34QbIgDh8). Spectators are phones in the room without
	 * a seat. The Storyteller opens a vote on the players, watches the count, and decides: how
	 * votes are counted isn't published, so every player with the most votes is shown.
	 */
	interface Props {
		gameId: GameId;
	}

	let { gameId }: Props = $props();

	const record = $derived(readGameMode(gameId));
	const mode = $derived(findMode(record?.modeId ?? '') ?? STANDARD);
	const step = $derived(
		mode.parts.daySteps?.find(
			(s): s is Extract<DayStep, { kind: 'spectator-vote' }> => s.kind === 'spectator-vote'
		)
	);

	let open = $state.raw<OpenGame | undefined>();
	let missing = $state(false);
	let inspecting = $state(false);

	$effect(() => {
		const id = gameId;
		let cancelled = false;
		(async () => {
			try {
				const game = await OpenGame.open(await loadOfficialData(), id);
				if (cancelled) return;
				if (!game) missing = true;
				else {
					// Phones in the room follow the game while this page is open.
					attachRoom(game);
					open = game;
				}
			} catch (e) {
				reportError(e, { area: 'grimoire' });
			}
		})();
		return () => (cancelled = true);
	});

	const host = roomHost();
	const seats = $derived(open?.game.seating ?? []);
	const spectators = $derived(host.members.filter((m) => m.seatId === undefined).length);

	// The last count stays shown after the vote closes, so the Storyteller can act on it.
	let last = $state.raw<VoteTally | undefined>();
	$effect(() => {
		if (host.vote) last = host.vote;
	});
	const shown = $derived(host.vote ?? last);
	const most = $derived.by(() => {
		if (!shown || shown.voted === 0) return new Set<SeatId>();
		const top = Math.max(...shown.options.map((o) => shown.counts[o] ?? 0));
		return new Set(shown.options.filter((o) => (shown.counts[o] ?? 0) === top));
	});

	function label(seatId: SeatId): string {
		const number = t('common.seat', { number: (open && seatNumber(open.game, seatId)) ?? 0 });
		const name = open?.game.seats[seatId]?.playerName;
		return name ? `${number} · ${name}` : number;
	}

	function openVote() {
		last = undefined;
		host.openVote([...seats]);
	}
</script>

<Page title={step?.ability ?? mode.name}>
	{#snippet actions()}
		<!-- An icon, so a long mode name keeps the title row (Trevor, 2026-10-18). -->
		<IconButton
			icon="info"
			label={t('modes.inspect', { name: mode.name })}
			onclick={() => (inspecting = true)}
		/>
	{/snippet}

	{#if missing}
		<p role="alert">{t('modes.specters.missing')}</p>
	{/if}

	<PageSection title={t('modes.specters.ability')}>
		<dl class="facts">
			<dt>{t('modes.field.when')}</dt>
			<dd><ModeValue field="when" value={step?.when ?? 'each-dawn'} /></dd>
			<dt>{t('modes.field.grants')}</dt>
			<dd>
				{#each step?.grants ?? [] as id (id)}
					<CharacterBadge characterId={id} />
				{:else}
					{t('common.none')}
				{/each}
			</dd>
			<dt>{t('modes.field.lasts')}</dt>
			<dd><ModeValue field="lasts" value={step?.lasts ?? 'until-next-dawn'} /></dd>
		</dl>
	</PageSection>

	<PageSection title={t('modes.specters.vote')}>
		<!-- Every row and button is always drawn, so a vote opening or closing moves nothing. -->
		<p class="muted" data-testid="specters-room">
			{host.code
				? t('modes.specters.spectators', { voted: shown?.voted ?? 0, count: spectators })
				: t('modes.specters.noRoom')}
		</p>
		<div class="buttons">
			<Button href={resolve('/grimoire/[gameId]/room', { gameId })} icon="share">
				{t('room.title')}
			</Button>
			<Button
				variant="accent"
				icon="vote"
				disabled={!host.code || host.status !== 'open' || seats.length === 0}
				onclick={openVote}
			>
				{host.vote ? t('modes.specters.reopen') : t('modes.specters.open')}
			</Button>
			<Button icon="close" disabled={!host.vote} onclick={() => host.closeVote()}>
				{t('modes.specters.close')}
			</Button>
		</div>
		<ol class="tally" data-testid="specters-tally">
			{#each seats as seatId (seatId)}
				<li data-most={most.has(seatId) || undefined}>
					<span>{label(seatId)}</span>
					<span class="count">{shown?.counts[seatId] ?? 0}</span>
				</li>
			{/each}
		</ol>
	</PageSection>
</Page>

<ModeInspectDialog bind:open={inspecting} {mode} />

<style>
	p,
	dl {
		margin: 0;
	}
	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2) var(--space-3);
		align-items: center;
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.tally {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tally li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-sm);
	}
	.tally li[data-most] {
		border-color: var(--accent);
		background: var(--surface-selected);
	}
	.count {
		font-variant-numeric: tabular-nums;
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>

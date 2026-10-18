<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Character, CharacterId, GameData, Script } from '#lib/core/data/index.ts';
	import {
		assembleScript,
		campaignCandidates,
		campaignOver,
		campaignRule,
		defaultEliminated,
		executedCharacters,
		flowCharacter,
		nextCampaignScript,
		STANDARD,
		type Replacement
	} from '#lib/core/modes/index.ts';
	import { setupComplete } from '#lib/core/rules/bag-plan.ts';
	import { SEATED_TYPES, type SeatedType } from '#lib/core/rules/distribution.ts';
	import { dayNumber } from '#lib/core/rules/night-order.ts';
	import { deriveGameRecord } from '#lib/core/stats/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { gameStore, OpenGame } from '#lib/features/game/session.svelte.ts';
	import { endedGames } from '#lib/features/grimoire/device-notes.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import Page from '#lib/ui/layout/Page.svelte';
	import PageSection from '#lib/ui/layout/PageSection.svelte';
	import ModeInspectDialog from './ModeInspectDialog.svelte';
	import {
		campaign as readCampaign,
		eliminatedSoFar,
		saveCampaign,
		type Campaign
	} from './campaigns.ts';
	import { findMode } from './custom-modes.svelte.ts';
	import { writeGameMode } from './game-mode-store.ts';

	/**
	 * A campaign of a mode like Flesh and Bone (https://fleshandbone.app/rules.php): its games
	 * in order, the characters eliminated so far, and, once the current game has ended, the
	 * next game's script made from it. The Storyteller decides which executed characters are
	 * eliminated (the rules have per-character exceptions) and can roll any replacement again.
	 */
	interface Props {
		campaignId: string;
	}

	let { campaignId }: Props = $props();

	// The page re-reads the campaign after starting the next game.
	let saved = $state<Campaign | undefined>();
	const record = $derived(saved ?? readCampaign(campaignId));
	const mode = $derived(findMode(record?.modeId ?? '') ?? STANDARD);
	const rule = $derived(campaignRule(mode));

	let data = $state.raw<GameData | undefined>();
	let games = $state.raw<(OpenGame | undefined)[]>([]);
	let inspecting = $state(false);

	$effect(() => {
		const ids = record?.games.map((g) => g.gameId) ?? [];
		let cancelled = false;
		(async () => {
			try {
				const loaded = await loadOfficialData();
				const opened = await Promise.all(ids.map((id) => OpenGame.open(loaded, id)));
				if (cancelled) return;
				data = loaded;
				games = opened;
			} catch (e) {
				reportError(e, { area: 'grimoire' });
			}
		})();
		return () => (cancelled = true);
	});

	const current = $derived(games.at(-1));
	const ended = $derived(current ? endedGames.read()[current.game.gameId] : undefined);
	const eliminated = $derived(record ? eliminatedSoFar(record) : []);

	function scriptCharacters(open: OpenGame): Character[] {
		return open.game.script.entries.flatMap((e): Character[] => {
			const c = e.kind === 'custom' ? e.character : open.characters.get(e.id);
			return c ? [c] : [];
		});
	}

	const currentScript = $derived(current ? scriptCharacters(current) : []);
	const over = $derived(current !== undefined && campaignOver(mode, currentScript));

	function openHref(open: OpenGame) {
		const gameId = open.game.gameId;
		return setupComplete(open.game)
			? resolve('/grimoire/[gameId]', { gameId })
			: resolve('/grimoire/[gameId]/setup', { gameId });
	}

	function nameOf(id: CharacterId): Character | undefined {
		return current?.characters.get(id) ?? data?.byId.get(id);
	}

	// The next game: who is eliminated, and the script that leaves.
	let planning = $state(false);
	let executed = $state.raw<CharacterId[]>([]);
	let flow = $state.raw<Character | undefined>();
	let chosen = $state.raw<CharacterId[]>([]);
	let replacements = $state.raw<Replacement[]>([]);
	let added = $state.raw<Character | undefined>();
	let creating = $state(false);

	/** Candidates for each listed character, flow character last, each once. */
	const listed = $derived([...executed, ...(flow && !executed.includes(flow.id) ? [flow.id] : [])]);

	function plan(next: CharacterId[]) {
		if (!data || !record) return;
		chosen = next;
		const made = nextCampaignScript({
			mode,
			script: currentScript,
			eliminate: next,
			eliminatedBefore: eliminated,
			official: data.characters,
			restrictions: record.restrictions,
			random: Math.random
		});
		// Keep the replacements already shown for characters still leaving.
		const kept = new Map(replacements.map((r) => [r.out.id, r]));
		replacements = made.replacements.map((r) => kept.get(r.out.id) ?? r);
		added = made.added ? (added ?? made.added) : undefined;
		// A new pick can match one kept from before: roll it again.
		replacements.forEach((r, i) => {
			if (!kept.has(r.out.id) && r.in && others(i).some((c) => c.id === r.in?.id))
				rollReplacement(i);
		});
		if (added && others(-1).some((c) => c.id === added?.id)) rollAdded();
	}

	async function openPlan() {
		if (!current || !data || !rule) return;
		try {
			const saved = await gameStore().load(current.game.gameId);
			const ending = endedGames.read()[current.game.gameId];
			if (!saved || !ending) return;
			const gameRecord = deriveGameRecord(saved, ending, data);
			executed = executedCharacters(gameRecord);
			// "The scripts must flow": offered when nothing would otherwise change.
			const growing =
				rule.growDemons &&
				currentScript.filter((c) => c.type === 'demon').length < rule.target.demon;
			flow =
				executed.length === 0 && !growing
					? flowCharacter(currentScript, gameRecord.winner)
					: undefined;
			replacements = [];
			added = undefined;
			plan(executed.length > 0 ? defaultEliminated(rule, executed) : flow ? [flow.id] : []);
			planning = true;
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		}
	}

	function toggle(id: CharacterId, on: boolean) {
		plan(on ? [...chosen, id] : chosen.filter((c) => c !== id));
	}

	const isSeated = (type: string): type is SeatedType =>
		(SEATED_TYPES as readonly string[]).includes(type);

	/** The characters joining the script, except replacement `skip` (-1: the added Demon). */
	function others(skip: number): Character[] {
		return [
			...replacements.flatMap((r, i) => (r.in && i !== skip ? [r.in] : [])),
			...(added && skip !== -1 ? [added] : [])
		];
	}

	function rollReplacement(i: number) {
		const r = replacements[i];
		if (!data || !record || !r || !isSeated(r.out.type)) return;
		const leaving = new Set(chosen);
		const pool = campaignCandidates(
			mode,
			r.out.type,
			currentScript.filter((c) => !leaving.has(c.id)),
			[...eliminated, ...chosen],
			data.characters,
			record.restrictions,
			others(i)
		);
		if (pool.length === 0) return;
		const next = pool[Math.floor(Math.random() * pool.length)];
		replacements = replacements.map((x, j) => (j === i ? { out: x.out, in: next } : x));
	}

	function rollAdded() {
		if (!data || !record || !added) return;
		const leaving = new Set(chosen);
		const pool = campaignCandidates(
			mode,
			'demon',
			currentScript.filter((c) => !leaving.has(c.id)),
			[...eliminated, ...chosen],
			data.characters,
			record.restrictions,
			others(-1)
		);
		if (pool.length > 0) added = pool[Math.floor(Math.random() * pool.length)];
	}

	const nextCharacters = $derived(assembleScript(currentScript, replacements, added));

	async function startNext() {
		if (!current || !data || !record) return;
		creating = true;
		try {
			const base = current.game.script;
			const custom = new Map(
				base.entries.flatMap((e) => (e.kind === 'custom' ? [[e.character.id, e] as const] : []))
			);
			const first = games[0]?.game.script.meta?.name ?? mode.name;
			const script: Script = {
				...base,
				meta: {
					...base.meta,
					name: t('modes.campaign.scriptName', { name: first, number: record.games.length + 1 })
				},
				entries: [
					...nextCharacters.map((c) => custom.get(c.id) ?? { kind: 'official' as const, id: c.id }),
					// Travellers, Fabled and Loric on the script stay.
					...base.entries.filter((e) => {
						const c = e.kind === 'custom' ? e.character : current.characters.get(e.id);
						return c !== undefined && !isSeated(c.type);
					})
				]
			};
			const open = await OpenGame.create(data, script, current.game.seating.length);
			// The same players play on: names carry over seat by seat.
			for (const [i, seatId] of current.game.seating.entries()) {
				const name = current.game.seats[seatId]?.playerName;
				const to = open.game.seating[i];
				if (name && to) open.run({ type: 'RenameSeat', seatId: to, playerName: name });
			}
			writeGameMode(open.game.gameId, { modeId: mode.id, restrictions: record.restrictions });
			const played = record.games.map((g, i) =>
				i === record!.games.length - 1 ? { ...g, eliminated: chosen } : g
			);
			const next = {
				...record,
				games: [...played, { gameId: open.game.gameId, eliminated: [], script: open.game.script }]
			};
			saveCampaign(next);
			saved = next;
			planning = false;
			await goto(resolve('/grimoire/[gameId]/setup', { gameId: open.game.gameId }));
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		} finally {
			creating = false;
		}
	}
</script>

<Page title={mode.name}>
	{#snippet actions()}
		<!-- An icon, so a long mode name keeps the title row (Trevor, 2026-10-18). -->
		<IconButton
			icon="info"
			label={t('modes.inspect', { name: mode.name })}
			onclick={() => (inspecting = true)}
		/>
	{/snippet}

	{#if !record}
		<p role="alert">{t('modes.campaign.missing')}</p>
	{:else}
		<PageSection title={t('modes.campaign.games')}>
			<ol class="games" data-testid="campaign-games">
				{#each record.games as g, i (g.gameId)}
					{@const open = games[i]}
					<li class="game">
						<span>{t('modes.campaign.game', { number: i + 1 })}</span>
						<span class="muted">
							{#if !open}
								{t('modes.campaign.gone')}
							{:else if endedGames.read()[g.gameId]}
								{t('modes.campaign.ended')}
							{:else if setupComplete(open.game)}
								{t('modes.towns.day', { day: dayNumber(open.game) })}
							{:else}
								{t('modes.towns.setup')}
							{/if}
						</span>
						{#if open}
							<Button icon="grimoire" href={openHref(open)}>
								{t('modes.campaign.open', { number: i + 1 })}
							</Button>
						{/if}
					</li>
				{/each}
			</ol>
			<!-- Always shown, disabled until the current game has ended, so nothing moves. -->
			<div class="next">
				<p class="muted" data-testid="campaign-next-hint">
					{over
						? t('modes.campaign.over')
						: ended
							? t('modes.campaign.ready')
							: t('modes.campaign.notEnded')}
				</p>
				<Button
					variant="accent"
					icon="forward"
					disabled={!ended || over || !data}
					onclick={openPlan}
				>
					{t('modes.campaign.next')}
				</Button>
			</div>
		</PageSection>

		<PageSection title={t('modes.campaign.eliminated')}>
			<ul class="badges" data-testid="campaign-eliminated">
				{#each eliminated as id (id)}
					{@const c = nameOf(id)}
					<li><CharacterBadge characterId={id} character={c} /></li>
				{:else}
					<li class="muted">{t('common.none')}</li>
				{/each}
			</ul>
		</PageSection>
	{/if}
</Page>

<ModeInspectDialog bind:open={inspecting} {mode} />

<Dialog bind:open={planning} title={t('modes.campaign.next')} size="full">
	<div class="plan" data-testid="campaign-plan">
		<h3>{t('modes.campaign.executed')}</h3>
		<ul class="rows">
			{#each listed as id (id)}
				{@const c = nameOf(id)}
				<li class="row">
					<CharacterBadge characterId={id} character={c} />
					<Toggle
						label={id === flow?.id ? t('modes.campaign.flow') : t('modes.campaign.eliminate')}
						checked={chosen.includes(id)}
						onChange={(on) => toggle(id, on)}
					/>
				</li>
			{:else}
				<li class="muted">{t('common.none')}</li>
			{/each}
		</ul>

		<h3>{t('modes.campaign.changes')}</h3>
		<ul class="rows" data-testid="campaign-changes">
			{#each replacements as r, i (r.out.id)}
				<li class="row">
					<span class="swap">
						<CharacterBadge characterId={r.out.id} character={r.out} />
						<span class="muted">{t('modes.campaign.replacedBy')}</span>
						{#if r.in}
							<CharacterBadge characterId={r.in.id} character={r.in} />
						{:else}
							<span class="muted">{t('common.none')}</span>
						{/if}
					</span>
					<IconButton
						icon="random"
						label={t('modes.extras.rollOne', { name: r.in?.name ?? r.out.name })}
						disabled={!r.in}
						onclick={() => rollReplacement(i)}
					/>
				</li>
			{/each}
			{#if added}
				<li class="row">
					<span class="swap">
						<span class="muted">{t('modes.campaign.added')}</span>
						<CharacterBadge characterId={added.id} character={added} />
					</span>
					<IconButton
						icon="random"
						label={t('modes.extras.rollOne', { name: added.name })}
						onclick={rollAdded}
					/>
				</li>
			{/if}
			{#if replacements.length === 0 && !added}
				<li class="muted">{t('common.none')}</li>
			{/if}
		</ul>
		<p class="muted">{t('modes.campaign.scriptSize', { count: nextCharacters.length })}</p>
	</div>
	{#snippet actions()}
		<ModalActions onCancel={() => (planning = false)} onConfirm={startNext} disabled={creating} />
	{/snippet}
</Dialog>

<style>
	h3,
	p {
		margin: 0;
	}
	h3 {
		font-size: 1rem;
	}
	.games,
	.rows,
	.badges {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
	}
	.game,
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: var(--space-1) var(--space-2);
		border: 1px solid var(--card-border);
		border-radius: var(--radius-sm);
	}
	.swap {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.next {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.plan {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		flex: 1;
		min-height: 0;
		overflow-y: auto;
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>

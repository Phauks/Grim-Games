<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { Character, CharacterType } from '#lib/core/data/index.ts';
	import { SEATED_TYPES } from '#lib/core/rules/distribution.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { OpenGame } from '#lib/features/game/session.svelte.ts';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { findMode } from './custom-modes.svelte.ts';
	import { townGroup } from './town-groups.ts';
	import { townDrawHref } from './town-setup.ts';

	/**
	 * Both towns' characters side by side once every bag is built, before anyone draws
	 * (Trevor, 2026-10-18: "before requiring bag draw ... show a screen to review the
	 * characters in both scripts"). Each town's Edit goes back to its setup; Draw opens the
	 * draw. Shared by Two Towns and a Boomdandy and Two games at once.
	 */
	interface Props {
		groupId: string;
	}

	let { groupId }: Props = $props();

	const group = $derived(townGroup(groupId));
	const mode = $derived(findMode(group?.modeId ?? ''));
	let towns = $state.raw<OpenGame[] | undefined>();
	let missing = $state(false);

	$effect(() => {
		const ids = group?.gameIds ?? [];
		let cancelled = false;
		(async () => {
			try {
				const data = await loadOfficialData();
				const opened = await Promise.all(ids.map((id) => OpenGame.open(data, id)));
				if (cancelled) return;
				if (opened.some((g) => !g) || ids.length === 0) missing = true;
				towns = opened.filter((g): g is OpenGame => !!g);
			} catch (e) {
				reportError(e, { area: 'setup' });
			}
		})();
		return () => (cancelled = true);
	});

	const TYPES: readonly CharacterType[] = [...SEATED_TYPES, 'traveller'];

	/** The characters in a town's bag, as the grimoire will have them, by type. */
	function byType(open: OpenGame): { type: CharacterType; characters: Character[] }[] {
		const characters = Object.values(open.game.bag?.tiles ?? {}).flatMap(
			(tile) => open.characters.get(tile.grimoire) ?? []
		);
		return TYPES.map((type) => ({
			type,
			characters: characters.filter((c) => c.type === type)
		})).filter((g) => g.characters.length > 0);
	}

	const ready = $derived(!!towns && towns.length > 0 && towns.every((o) => o.game.bag));
</script>

<Page title={t('modes.towns.reviewTitle')}>
	{#if !group || missing}
		<p role="alert">{t('modes.towns.missing')}</p>
	{/if}

	{#if towns}
		<ol class="towns">
			{#each towns as open, i (open.game.gameId)}
				{@const groups = byType(open)}
				<li class="town" data-testid="review-town">
					<div class="head">
						<h2>
							{t('modes.towns.townScript', {
								number: i + 1,
								script: open.game.script.meta?.name ?? t('common.none')
							})}
						</h2>
						<Button
							icon="rename"
							onclick={() =>
								void goto(resolve('/grimoire/[gameId]/setup', { gameId: open.game.gameId }))}
						>
							{t('modes.towns.edit', { number: i + 1 })}
						</Button>
					</div>
					{#if groups.length === 0}
						<p class="muted">{t('common.none')}</p>
					{/if}
					{#each groups as g (g.type)}
						<div class="type">
							<span class="muted">{TYPE_LABELS[g.type]}</span>
							<ul class="characters">
								{#each g.characters as c, j (c.id + j)}
									<li><CharacterBadge characterId={c.id} character={c} inline /></li>
								{/each}
							</ul>
						</div>
					{/each}
				</li>
			{/each}
		</ol>

		<div class="next">
			<Button
				variant="accent"
				icon="bag"
				disabled={!ready || !group}
				onclick={() => group && void goto(townDrawHref(group, mode))}
			>
				{t('modes.towns.reviewDraw')}
			</Button>
		</div>
	{/if}
</Page>

<style>
	h2,
	p {
		margin: 0;
	}
	h2 {
		font-size: 1.1rem;
	}
	.towns {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(calc(16 * var(--u)), 1fr));
		gap: var(--space-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.town {
		display: grid;
		align-content: start;
		gap: var(--space-2);
		padding: var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-sm);
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.type {
		display: grid;
		gap: var(--space-1);
	}
	.characters {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.muted {
		color: var(--on-surface-muted);
	}
	.next {
		display: flex;
		justify-content: flex-end;
	}
</style>

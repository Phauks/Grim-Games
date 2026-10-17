<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { BagPlan, ScriptJinx, SetupAnalysis } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';

	interface Props {
		analysis: SetupAnalysis;
		plan: BagPlan;
		/** Jinxes between selected characters. */
		jinxes: readonly ScriptJinx[];
		/** Warnings in plain words, from the setup analysis, the bag and exclusive jinxes. */
		warnings: readonly string[];
		lookup: (id: CharacterId) => Character | undefined;
		/** Custom characters in play whose setup reminders the app can't work out. */
		uncurated?: readonly CharacterId[];
		/** Opens the choice of what a Drunk, Marionette or Lunatic is shown. */
		onStandIn: (characterId: CharacterId) => void;
	}

	let { analysis, plan, jinxes, warnings, lookup, uncurated = [], onStandIn }: Props = $props();

	const name = (id: CharacterId) => lookup(id)?.name ?? id;
	const warningCount = $derived(warnings.length + (uncurated.length ? 1 : 0));
</script>

<!--
	Everything the counts bar can't show, always on screen so the Storyteller sees it
	(Trevor, 2026-10-16): warnings, stand-ins, setup changes and jinxes. Each section keeps
	its header and shows None when empty. It warns; it never blocks.
-->
<section class="check" aria-label={t('setup.check')} data-testid="setup-check">
	<div class="body">
		<Collapsible title={t('setup.check.warnings')} level={3} storageKey="setup-check:warnings">
			{#snippet aside()}<span
					class="count"
					data-warn={warningCount ? '' : undefined}
					data-testid="warning-count">{warningCount}</span
				>{/snippet}
			{#if warningCount}
				<ul class="warn">
					{#each warnings as warning, i (i)}<li><GlossaryText text={warning} /></li>{/each}
					{#if uncurated.length}
						<li data-testid="custom-reminders">
							{t('setup.check.customReminders')}
							<span class="badges">
								{#each uncurated as id (id)}<CharacterBadge
										characterId={id}
										character={lookup(id)}
									/>{/each}
							</span>
						</li>
					{/if}
				</ul>
			{:else}<p>{t('common.none')}</p>{/if}
		</Collapsible>

		<Collapsible
			title={t('setup.check.shownInstead')}
			level={3}
			storageKey="setup-check:shown-instead"
		>
			{#if plan.standIns.length}
				<ul class="stand-ins">
					{#each plan.standIns as standIn (standIn.characterId)}
						<li data-testid="stand-in-{standIn.characterId}">
							<CharacterBadge characterId={standIn.characterId} />
							<span>{t('setup.check.isShown')}</span>
							{#if standIn.options.length}
								<Button
									variant="quiet"
									aria-label={t('setup.check.shownTo', { name: name(standIn.characterId) })}
									onclick={() => onStandIn(standIn.characterId)}
									>{standIn.shows ? name(standIn.shows) : t('setup.check.choose')}</Button
								>
							{:else}<span>{t('common.none')}</span>{/if}
						</li>
					{/each}
				</ul>
			{:else}<p>{t('common.none')}</p>{/if}
		</Collapsible>

		<Collapsible
			title={t('setup.check.setupChanges')}
			level={3}
			storageKey="setup-check:setup-changes"
		>
			{#if analysis.modifiers.length || analysis.notes.length}
				<ul>
					{#each analysis.modifiers as modifier (modifier.id)}
						<li><GlossaryText text={modifier.explanation} /></li>
					{/each}
					{#each analysis.notes as note, i (i)}<li><GlossaryText text={note} /></li>{/each}
				</ul>
			{:else}<p>{t('common.none')}</p>{/if}
		</Collapsible>

		<Collapsible title={t('setup.check.jinxes')} level={3} storageKey="setup-check:jinxes">
			{#if jinxes.length}
				<ul>
					{#each jinxes as jinx (jinx.characters.join('+'))}
						<li>
							<CharacterBadge characterId={jinx.characters[0]} inline />
							{t('setup.check.and')}
							<CharacterBadge characterId={jinx.characters[1]} inline />: {jinx.reason}
						</li>
					{/each}
				</ul>
			{:else}<p>{t('common.none')}</p>{/if}
		</Collapsible>
	</div>
</section>

<style>
	.check {
		padding: var(--space-1) var(--space-3) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
	}
	.check:has(.warn) {
		box-shadow: inset 0 0 0 2px var(--accent);
	}
	.badges {
		display: inline-flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.body {
		display: grid;
		gap: var(--space-1);
		font-size: 0.9rem;
	}
	p,
	ul {
		margin: 0;
	}
	ul {
		display: grid;
		gap: var(--space-2);
		padding-inline-start: 1.2em;
	}
	.count {
		display: inline-grid;
		place-items: center;
		min-width: 1.6em;
		height: 1.6em;
		padding: 0 0.3em;
		border-radius: var(--radius-full);
		background: var(--surface);
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.count[data-warn] {
		background: var(--accent);
		color: var(--on-accent, var(--on-surface));
	}
	.stand-ins {
		padding: 0;
		list-style: none;
	}
	.stand-ins li {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
	}
</style>

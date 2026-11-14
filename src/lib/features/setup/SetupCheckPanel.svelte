<script lang="ts">
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import type { BagPlan } from '#lib/core/rules/setup/bag-plan.ts';
	import type { ScriptJinx } from '#lib/core/rules/jinxes/jinxes.ts';
	import type { SetupAnalysis } from '#lib/core/rules/setup/setup.ts';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Icon from '#lib/ui/icons/Icon.svelte';

	interface Props {
		analysis: SetupAnalysis;
		plan: BagPlan;
		/** Jinxes between selected characters. */
		jinxes: readonly ScriptJinx[];
		/** Warnings in plain words, from the setup analysis, the bag and exclusive jinxes. */
		warnings: readonly string[];
		lookup: (id: CharacterId) => Character | undefined;
		/** The script's own characters in play, and whether the Storyteller checked each (M85). */
		own?: readonly { character: Character; checked: boolean }[];
		/** Opens the check of one of the script's own characters. */
		onCheck?: (characterId: CharacterId) => void;
		/** Opens the choice of what a Drunk, Marionette or Lunatic is shown. */
		onStandIn: (characterId: CharacterId) => void;
	}

	let { analysis, plan, jinxes, warnings, lookup, own = [], onCheck, onStandIn }: Props = $props();

	const name = (id: CharacterId) => lookup(id)?.name ?? id;
	const unchecked = $derived(own.filter((o) => !o.checked).map((o) => o.character));
	const warningCount = $derived(warnings.length + (unchecked.length ? 1 : 0));
	const changeCount = $derived(analysis.modifiers.length + analysis.notes.length);
	// Verification counts everything inside it (Trevor, 2026-10-20).
	const total = $derived(
		warningCount + own.length + plan.standIns.length + changeCount + jinxes.length
	);
</script>

<!--
	Everything the counts bar can't show, always on screen so the Storyteller sees it
	(Trevor, 2026-10-16): warnings, stand-ins, setup changes and jinxes. Each section keeps
	its header and shows None when empty. It warns; it never blocks.
-->
<section class="check" aria-label={t('setup.check')} data-testid="setup-check">
	<!-- One section, Verification, that folds away when not in use (Trevor, 2026-10-19). -->
	<Collapsible
		title={t('setup.check.verification')}
		level={3}
		storageKey="setup-check:verification"
	>
		{#snippet aside()}<CountBadge
				count={total}
				warn={warningCount > 0}
				testid="verification-count"
			/>{/snippet}
		<div class="body">
			<Collapsible
				title={t('setup.check.warnings')}
				level={4}
				storageKey="setup-check:warnings"
				empty={warningCount === 0}
			>
				{#snippet aside()}<CountBadge
						count={warningCount}
						warn={warningCount > 0}
						testid="warning-count"
					/>{/snippet}
				{#if warningCount}
					<ul class="warn">
						{#each warnings as warning, i (i)}<li><GlossaryText text={warning} /></li>{/each}
						{#if unchecked.length}
							<li data-testid="custom-unchecked">
								{t('setup.check.unchecked')}
								<span class="badges">
									{#each unchecked as character (character.id)}<CharacterPiece
											template="badge"
											characterId={character.id}
											{character}
										/>{/each}
								</span>
							</li>
						{/if}
					</ul>
				{:else}<p>{t('common.none')}</p>{/if}
			</Collapsible>

			<Collapsible
				title={t('setup.check.ownCharacters')}
				level={4}
				storageKey="setup-check:own-characters"
				empty={own.length === 0}
			>
				{#snippet aside()}<CountBadge
						count={own.length}
						warn={unchecked.length > 0}
						testid="own-character-count"
					/>{/snippet}
				{#if own.length}
					<ul class="stand-ins">
						{#each own as { character, checked } (character.id)}
							<li data-testid="own-character-{character.id}">
								<CharacterPiece template="badge" characterId={character.id} {character} />
								<span class="state"
									><Icon name={checked ? 'check' : 'warning'} />{checked
										? t('setup.check.isChecked')
										: t('setup.check.notChecked')}</span
								>
								<span class="end"
									><Button
										variant="quiet"
										icon="edit"
										aria-label={t('setup.check.checkFor', { name: character.name })}
										onclick={() => onCheck?.(character.id)}>{t('setup.check.check')}</Button
									></span
								>
							</li>
						{/each}
					</ul>
				{:else}<p>{t('common.none')}</p>{/if}
			</Collapsible>

			<Collapsible
				title={t('setup.check.shownInstead')}
				level={4}
				storageKey="setup-check:shown-instead"
				empty={plan.standIns.length === 0}
			>
				{#snippet aside()}<CountBadge
						count={plan.standIns.length}
						testid="shown-instead-count"
					/>{/snippet}
				{#if plan.standIns.length}
					<ul class="stand-ins">
						{#each plan.standIns as standIn (standIn.characterId)}
							<li data-testid="stand-in-{standIn.characterId}">
								<CharacterPiece template="badge" characterId={standIn.characterId} />
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
				level={4}
				storageKey="setup-check:setup-changes"
				empty={changeCount === 0}
			>
				{#snippet aside()}<CountBadge count={changeCount} testid="setup-change-count" />{/snippet}
				{#if changeCount}
					<ul>
						{#each analysis.modifiers as modifier (modifier.id)}
							<li><GlossaryText text={modifier.explanation} /></li>
						{/each}
						{#each analysis.notes as note, i (i)}<li><GlossaryText text={note} /></li>{/each}
					</ul>
				{:else}<p>{t('common.none')}</p>{/if}
			</Collapsible>

			<Collapsible
				title={t('setup.check.jinxes')}
				level={4}
				storageKey="setup-check:jinxes"
				empty={jinxes.length === 0}
			>
				{#snippet aside()}<CountBadge count={jinxes.length} testid="jinx-count" />{/snippet}
				{#if jinxes.length}
					<ul>
						{#each jinxes as jinx (jinx.characters.join('+'))}
							<li>
								<CharacterPiece template="badge" characterId={jinx.characters[0]} />
								{t('setup.check.and')}
								<CharacterPiece template="badge" characterId={jinx.characters[1]} />: {jinx.reason}
							</li>
						{/each}
					</ul>
				{:else}<p>{t('common.none')}</p>{/if}
			</Collapsible>
		</div>
	</Collapsible>
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
	.stand-ins {
		padding: 0;
		list-style: none;
	}
	.end {
		justify-self: end;
	}
	.state {
		display: inline-flex;
		align-items: center;
		gap: 0.3em;
	}
	.stand-ins li {
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		align-items: center;
		gap: var(--space-2);
	}
</style>

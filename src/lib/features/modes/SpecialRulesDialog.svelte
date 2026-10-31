<script lang="ts">
	import {
		combineRules,
		type GameMode,
		SPECIAL_RULES,
		type RuleConflict,
		type SpecialRule
	} from '#lib/core/modes/index.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
	import { optionalRuleText, prefetchWikiPage } from '#lib/features/characters/wiki-page.svelte.ts';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { customRules, findRule } from './custom-rules.svelte.ts';
	import { modeLabel } from './labels.ts';
	import ModeInspectDialog from './ModeInspectDialog.svelte';
	import ShareModeDialog from './ShareModeDialog.svelte';
	import { shownAbout } from './own-wording.svelte.ts';
	import { RULE_SWITCHES, switched, switchOn, type SwitchChoices } from './rule-switches.ts';

	/**
	 * A game's special rules, on Character selection (Trevor, 2026-10-29; New game's until then.
	 * 2026-10-18: rules stack on a game mode, modes don't mix): one switch per rule, on in the
	 * order chosen. Two that set the same part differently are listed as conflicts; they warn,
	 * never stop the game starting. Each rule shows its description under its switch (Trevor,
	 * 2026-10-19), or the author's own rule text until he has approved one; everything else is
	 * behind Inspect. The rules in this game come first, restated with their own switches, as
	 * the screen before Start game did (Trevor, 2026-10-22, 2026-10-24), so the full list stays
	 * clean.
	 * Design: /mnt/project-files/world-cup-rules/format-design.md.
	 * Below them, the optional rules of the characters on the script (Trevor, 2026-10-30: an
	 * official character's optional rule is its own functionality, not a special rule), each
	 * a switch beside the character's badge, whose page has the rule's wiki text.
	 * The app's own rules have no Delete; the rules added on this device sit in a Custom section
	 * beneath them, each with Share and Delete (Trevor, 2026-10-31).
	 */
	interface Props {
		open: boolean;
		mode: GameMode;
		/** The chosen rules' ids, in the order chosen. */
		ruleIds: readonly string[];
		onChange: (ids: string[]) => void;
		/** The Storyteller's choices for rules' own switches (rule-switches.ts). */
		choices: SwitchChoices;
		onSwitch: (choices: SwitchChoices) => void;
		/** Add mode, which also takes a rule file. */
		onadd: () => void;
		/** The characters with an optional rule, each on or off for this game. */
		optionalRules?: readonly { characterId: CharacterId; character?: Character; on: boolean }[];
		onOptionalRule?: (characterId: CharacterId, on: boolean) => void;
	}

	let {
		open = $bindable(),
		mode,
		ruleIds,
		onChange,
		choices,
		onSwitch,
		onadd,
		optionalRules = [],
		onOptionalRule
	}: Props = $props();

	// Each optional rule's own wording comes from its character's wiki page, fetched live and
	// kept on this device only (CLAUDE.md).
	$effect(() => {
		for (const r of optionalRules) if (r.character) prefetchWikiPage(r.character);
	});

	const chosen = $derived(ruleIds.flatMap((id) => findRule(id) ?? []));
	const conflicts = $derived(combineRules(mode, chosen).conflicts);
	let inspecting = $state<GameMode | SpecialRule | undefined>();
	let inspectOpen = $state(false);
	let deleting = $state<SpecialRule | undefined>();
	let deleteOpen = $state(false);
	let sharing = $state<SpecialRule | undefined>();
	let shareOpen = $state(false);

	let term = $state('');
	/** Rules whose name, other names or description hold the search term. */
	function matching(rules: readonly SpecialRule[], term: string): readonly SpecialRule[] {
		const q = term.trim().toLocaleLowerCase();
		if (!q) return rules;
		return rules.filter((rule) =>
			[rule.name, ...(rule.aliases ?? []), shownAbout(rule) ?? rule.parts.text?.join(' ') ?? '']
				.join(' ')
				.toLocaleLowerCase()
				.includes(q)
		);
	}
	const shown = $derived(matching(SPECIAL_RULES, term));
	const shownCustom = $derived(matching(customRules.list, term));

	/** A conflict's side: the game mode, or a rule (switchable here). */
	const sideOf = (id: string): GameMode | SpecialRule =>
		id === mode.id ? mode : (findRule(id) ?? mode);
	function conflictText(c: RuleConflict): string {
		const [first, second] = c.ids.map((id) => sideOf(id).name);
		return c.part
			? t('modes.conflict', { part: modeLabel('part', c.part) })
			: t('modes.conflictListed', { first, second });
	}
	const description = (m: GameMode | SpecialRule) =>
		shownAbout(m) ??
		(m.kind === 'special-rule' ? m.parts.text?.join(' ') : undefined) ??
		t('common.none');

	function toggle(id: string, on: boolean) {
		onChange(on ? [...ruleIds.filter((x) => x !== id), id] : ruleIds.filter((x) => x !== id));
	}
	function inspect(m: GameMode | SpecialRule) {
		inspecting = m.kind === 'special-rule' ? switched(m, choices) : m;
		inspectOpen = true;
	}
</script>

{#snippet ruleRow(rule: SpecialRule, custom: boolean)}
	<div class="row">
		<Toggle
			label={rule.name}
			description={description(rule)}
			checked={ruleIds.includes(rule.id)}
			onChange={(on) => toggle(rule.id, on)}
		/>
		<IconButton
			icon="info"
			label={t('modes.inspectRule', { name: rule.name })}
			onclick={() => inspect(rule)}
		/>
		{#if custom}
			<IconButton
				icon="share"
				label={t('modes.shareFile', { name: rule.name })}
				onclick={() => {
					sharing = rule;
					shareOpen = true;
				}}
			/>
			<DeleteButton
				label={t('modes.deleteRule', { name: rule.name })}
				onclick={() => {
					deleting = rule;
					deleteOpen = true;
				}}
			/>
		{/if}
	</div>
{/snippet}

<Dialog bind:open title={t('modes.specialRulesTitle')} size="full">
	{#snippet headActions()}
		<IconButton icon="add" label={t('modes.add.button')} onclick={onadd} />
	{/snippet}
	<div class="rules">
		<SearchField bind:value={term} label={t('modes.searchRules')} />
		<section aria-labelledby="rules-in-game-title">
			<h3 id="rules-in-game-title">
				{t('modes.rulesInGame')}
				<CountBadge count={chosen.length} />
			</h3>
			<ul role="list" class="in-game" data-testid="rules-in-game">
				{#each chosen as rule (rule.id)}
					<li>
						{@render ruleRow(rule, false)}
						{#each RULE_SWITCHES[rule.id] ?? [] as sw (sw.id)}
							<div class="own">
								<Toggle
									label={t(sw.label(rule.id))}
									checked={switchOn(choices, rule.id, sw)}
									onChange={(on) => onSwitch({ ...choices, [`${rule.id}:${sw.id}`]: on })}
								/>
							</div>
						{/each}
					</li>
				{:else}
					<li class="muted">{t('common.none')}</li>
				{/each}
			</ul>
		</section>
		<section aria-labelledby="optional-rules-title">
			<h3 id="optional-rules-title">
				{t('modes.optionalRules')}
				<CountBadge count={optionalRules.filter((r) => r.on).length} />
			</h3>
			<ul role="list" class="in-game" data-testid="optional-rules">
				{#each optionalRules as rule (rule.characterId)}
					{@const name = rule.character?.name ?? rule.characterId}
					<li class="optional">
						{#if rule.character}
							{@const character = rule.character}
							<CharacterRow {character} info
								>{#snippet ability()}<GlossaryText
										text={character.ability}
										names={[character.name]}
									/>{/snippet}</CharacterRow
							>
						{:else}
							<CharacterBadge characterId={rule.characterId} />
						{/if}
						<div class="row own">
							<p class="rule">
								{(rule.character && optionalRuleText(rule.character)) ?? t('modes.optionalRule')}
							</p>
							<Toggle
								label={t('modes.optionalRuleOf', { name })}
								hideLabel
								checked={rule.on}
								disabled={!onOptionalRule}
								onChange={(on) => onOptionalRule?.(rule.characterId, on)}
							/>
						</div>
					</li>
				{:else}
					<li class="muted">{t('common.none')}</li>
				{/each}
			</ul>
		</section>
		<!-- Conflicts first (Trevor, 2026-10-22: "move conflicts to the top"), each with both
		sides' descriptions, Inspect and switch, so it can be settled here. -->
		<section aria-labelledby="rule-conflicts-title">
			<h3 id="rule-conflicts-title">{t('modes.conflicts')}</h3>
			{#if conflicts.length}
				<ul role="list" class="conflicts" data-testid="rule-conflicts">
					{#each conflicts as c (`${c.ids.join(' ')} ${c.part ?? ''}`)}
						<li class="conflict">
							<p class="why">{conflictText(c)}</p>
							{#each c.ids.map(sideOf) as side (side.id)}
								<div class="side">
									{#if side.kind === 'special-rule'}
										{@render ruleRow(side, false)}
									{:else}
										<div class="row">
											<span class="mode-name">{t('modes.conflictMode', { name: side.name })}</span>
											<IconButton
												icon="info"
												label={t('modes.inspect', { name: side.name })}
												onclick={() => inspect(side)}
											/>
										</div>
										<p class="description">{description(side)}</p>
									{/if}
								</div>
							{/each}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="muted" data-testid="rule-conflicts">{t('common.none')}</p>
			{/if}
		</section>
		<section aria-labelledby="rule-list-title">
			<h3 id="rule-list-title">{t('modes.allRules')}</h3>
			<ul role="list" class="rule-list" data-testid="special-rules">
				{#each shown as rule (rule.id)}
					<li>
						{@render ruleRow(rule, false)}
					</li>
				{:else}
					<li class="muted">{t('common.none')}</li>
				{/each}
			</ul>
		</section>
		<!-- Beneath the app's own: the rules added on this device, the only ones that can be
			shared or deleted (Trevor, 2026-10-31). -->
		<section aria-labelledby="custom-rules-title">
			<h3 id="custom-rules-title">
				{t('modes.customRules')}
				<CountBadge count={customRules.list.length} />
			</h3>
			<ul role="list" class="rule-list" data-testid="custom-rules">
				{#each shownCustom as rule (rule.id)}
					<li>
						{@render ruleRow(rule, true)}
					</li>
				{:else}
					<li class="muted">{t('common.none')}</li>
				{/each}
			</ul>
		</section>
	</div>
</Dialog>

{#if inspecting}
	<ModeInspectDialog bind:open={inspectOpen} mode={inspecting} />
{/if}
<ShareModeDialog bind:open={shareOpen} mode={sharing} />
<ConfirmDialog
	bind:open={deleteOpen}
	title={t('modes.deleteRuleConfirm', { name: deleting?.name ?? '' })}
	danger
	onConfirm={() => {
		if (!deleting) return;
		customRules.remove(deleting.id);
		onChange(ruleIds.filter((x) => x !== deleting?.id));
	}}
/>

<style>
	.rules {
		display: grid;
		align-content: start;
		gap: var(--space-4);
	}
	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.rule-list {
		display: grid;
	}
	/* A line between rules (Trevor, 2026-10-22: "better delineation between rules"). */
	.rule-list > li + li {
		border-top: 1px solid var(--border);
	}
	.rule-list > li {
		padding-block: var(--space-1);
	}
	/* The switch takes the row, its description beside it; Inspect and Delete on the name line. */
	.row {
		display: flex;
		align-items: flex-start;
		gap: var(--space-1);
	}
	.row > :global(:first-child) {
		flex: 1;
		min-width: 0;
	}
	/* A character's row, then its optional rule and switch beneath (Trevor, 2026-10-31). */
	.optional {
		display: grid;
		gap: var(--space-1);
		padding-block: var(--space-1);
	}
	.rule {
		margin: 0;
	}
	/* A rule's own switch, indented under its description. */
	.own {
		padding-inline-start: var(--space-4);
	}
	.in-game {
		display: grid;
	}
	.in-game > li + li {
		border-top: 1px solid var(--border);
	}
	h3 {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	/* The description under its switch, quieter, always there so nothing moves. */
	.description {
		margin: 0;
		color: var(--on-surface-muted);
		font-size: 0.9em;
	}
	h3 {
		margin: 0 0 var(--space-1);
		font-size: 1.05rem;
	}
	.conflicts {
		display: grid;
		gap: var(--space-3);
	}
	/* One conflict: why, in plain words, then each side with its own controls. */
	.conflict {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--evil);
		border-radius: var(--radius-sm);
	}
	.why {
		margin: 0;
		color: var(--evil-text);
	}
	.side {
		display: grid;
	}
	.mode-name {
		font-family: var(--font-control);
	}
	.muted {
		margin: 0;
		color: var(--on-surface-muted);
	}
</style>

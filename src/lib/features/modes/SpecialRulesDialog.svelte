<script lang="ts">
	import {
		combineRules,
		type GameMode,
		type RuleConflict,
		type SpecialRule
	} from '#lib/core/modes/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { allRules, customRules, findRule } from './custom-rules.svelte.ts';
	import { modeLabel } from './labels.ts';
	import ModeInspectDialog from './ModeInspectDialog.svelte';
	import { shownAbout } from './own-wording.svelte.ts';
	import { RULE_SWITCHES, switched, switchOn, type SwitchChoices } from './rule-switches.ts';

	/**
	 * New game's special rules (Trevor, 2026-10-18: rules stack on a game mode, modes don't
	 * mix): one switch per rule, on in the order chosen. Two that set the same part
	 * differently are listed as conflicts; they warn, never stop the game starting. Each rule
	 * shows its description under its switch (Trevor, 2026-10-19), or the author's own rule text
	 * until he has approved one; everything else is behind Inspect.
	 * Design: /mnt/project-files/world-cup-rules/format-design.md.
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
	}

	let { open = $bindable(), mode, ruleIds, onChange, choices, onSwitch, onadd }: Props = $props();

	const rules = $derived(allRules());
	const chosen = $derived(ruleIds.flatMap((id) => findRule(id) ?? []));
	const conflicts = $derived(combineRules(mode, chosen).conflicts);
	let inspecting = $state<GameMode | SpecialRule | undefined>();
	let inspectOpen = $state(false);
	let deleting = $state<SpecialRule | undefined>();
	let deleteOpen = $state(false);

	let term = $state('');
	/** Rules whose name, other names or description hold the search term. */
	const shown = $derived.by(() => {
		const q = term.trim().toLocaleLowerCase();
		if (!q) return rules;
		return rules.filter((rule) =>
			[rule.name, ...(rule.aliases ?? []), shownAbout(rule) ?? rule.parts.text?.join(' ') ?? '']
				.join(' ')
				.toLocaleLowerCase()
				.includes(q)
		);
	});

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

{#snippet ruleRow(rule: SpecialRule, withDelete: boolean)}
	<div class="row">
		<Toggle
			label={rule.name}
			checked={ruleIds.includes(rule.id)}
			onChange={(on) => toggle(rule.id, on)}
		/>
		<IconButton
			icon="info"
			label={t('modes.inspectRule', { name: rule.name })}
			onclick={() => inspect(rule)}
		/>
		{#if withDelete}
			<!-- Always there, so nothing moves; only a rule added on this device can go. -->
			<DeleteButton
				label={t('modes.deleteRule', { name: rule.name })}
				disabled={!customRules.list.some((r) => r.id === rule.id)}
				onclick={() => {
					deleting = rule;
					deleteOpen = true;
				}}
			/>
		{/if}
	</div>
	<p class="description" data-testid="rule-description">{description(rule)}</p>
{/snippet}

<Dialog bind:open title={t('modes.specialRulesTitle')} size="full">
	{#snippet headActions()}
		<IconButton icon="add" label={t('modes.add.button')} onclick={onadd} />
	{/snippet}
	<div class="rules">
		<SearchField bind:value={term} label={t('modes.searchRules')} />
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
			<ul role="list" data-testid="special-rules">
				{#each shown as rule (rule.id)}
					<li>
						{@render ruleRow(rule, true)}
						<!-- A rule's own switches: always there, so nothing moves; usable while it is on. -->
						{#each RULE_SWITCHES[rule.id] ?? [] as sw (sw.id)}
							<div class="switch">
								<Toggle
									label={t(sw.label)}
									checked={switchOn(choices, rule.id, sw)}
									disabled={!ruleIds.includes(rule.id)}
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
	</div>
</Dialog>

{#if inspecting}
	<ModeInspectDialog bind:open={inspectOpen} mode={inspecting} />
{/if}
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
	ul[data-testid='special-rules'] {
		display: grid;
		gap: var(--space-2);
	}
	/* The switch takes the row; Inspect and Delete their own size beside it. */
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-1);
	}
	.row > :global(:first-child) {
		flex: 1;
		min-width: 0;
	}
	/* A rule's own switch, indented under its description. */
	.switch {
		padding-left: var(--space-4);
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
		color: var(--evil);
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

<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, ReminderLabel } from '#lib/core/data/index.ts';
	import {
		BUILDER_RULES,
		builderRule,
		findRules,
		fitsFields,
		readRuleText,
		ruleProblems,
		ruleText,
		type BuilderRule
	} from '#lib/core/rules/character-builder-rules.ts';
	import { RULE_GROUPS, type RuleGroup } from '#lib/core/data/parts/part.ts';
	import { startFor } from '#lib/core/data/field-spec.ts';
	import { type CharacterFields } from '#lib/core/rules/character-builder.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import SearchField from '#lib/ui/primitives/SearchField.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import RuleValueField from './RuleValueField.svelte';

	/**
	 * Adds one rule to a custom character, or changes one it has (M62, Trevor picked "Add a
	 * rule", 2026-11-09). A new rule is found first (M80, Trevor 2026-11-12: "do it all"): by
	 * name or description in the search box, or under its group's tab (where it belongs in a
	 * game, `group` in its part file); then its settings are filled in with fields made for that
	 * rule (`RuleValueField`), and the rule's row above them goes back to finding another. "Rules text" writes the same rule as text instead, and is where a rule
	 * the fields can't hold whole (a setting they don't list) is changed, so nothing is lost.
	 */
	interface Props {
		open: boolean;
		fields: CharacterFields;
		/** Characters a rule can name (a jinx's partner). */
		characters: readonly Character[];
		/** The rule being changed; absent: a new rule. */
		editing?: { key: string; value: unknown };
		onSave: (key: string, value: unknown) => void;
	}

	let { open = $bindable(), fields, characters, editing, onSave }: Props = $props();

	const reminders = $derived(
		fields.reminders.map((r) => r.trim()).filter(Boolean) as ReminderLabel[]
	);

	/** Rules it can add: those it doesn't have yet, or the one being changed. */
	const available = $derived(
		editing
			? [builderRule(editing.key)]
			: BUILDER_RULES.filter((rule) => fields.rules?.[rule.key] === undefined)
	);

	let key = $state('');
	/** Finding the rule to add, before its settings. */
	let finding = $state(false);
	let query = $state('');
	let group = $state<RuleGroup>('setup');
	let value = $state<unknown>();
	let asText = $state(false);
	let rulesText = $state('');

	const rule = $derived<BuilderRule | undefined>(key ? builderRule(key) : undefined);

	/** A new rule's starting value: the first choice of a drop-down, else empty. */
	function initial(picked: BuilderRule): unknown {
		const field = picked.field;
		if (field.kind === 'enum') return field.values[0];
		if (field.kind === 'token') return reminders[0];
		if (field.kind === 'count') return 1;
		if (field.kind === 'boolean') return true;
		return startFor(field);
	}

	function load(next: string, current: unknown) {
		key = next;
		const picked = builderRule(next);
		value = current === undefined ? initial(picked) : current;
		// A local, not `asText`: reading state here would make the opening effect depend on it.
		const text = !fitsFields(picked, current);
		asText = text;
		rulesText = text ? ruleText(current) : '';
	}

	$effect(() => {
		if (!open) return;
		const start = editing;
		untrack(() => {
			query = '';
			finding = !start;
			if (start) load(start.key, start.value);
			else key = '';
		});
	});

	function pick(next: string) {
		load(next, undefined);
		finding = false;
	}

	const groupTabs = RULE_GROUPS.map((value) => ({
		value,
		label: t(`character-builder.ruleGroup.${value}`)
	}));

	const found = $derived(findRules(available, query));

	const read = $derived.by((): { value: unknown } | { error: string } | undefined => {
		if (!rule) return undefined;
		if (asText) return rulesText.trim() ? readRuleText(rulesText) : undefined;
		return value === undefined ? undefined : { value };
	});

	/** Whether the text can go back to fields: it reads, and the fields hold all of it. */
	const backToFields = $derived(
		!!rule &&
			rule.field.kind !== 'text' &&
			(!rulesText.trim() || (!!read && 'value' in read && fitsFields(rule, read.value)))
	);

	function setText(on: boolean) {
		if (on) {
			rulesText = ruleText(value);
		} else {
			if (!backToFields) return;
			value = read && 'value' in read ? read.value : undefined;
		}
		asText = on;
	}

	const problems = $derived.by((): string[] => {
		if (!read) return [];
		if ('error' in read) return [read.error];
		return ruleProblems(fields, key, read.value, reminders);
	});

	function save() {
		if (!read || 'error' in read || problems.length) return;
		onSave(key, read.value);
		open = false;
	}
</script>

{#snippet ruleList(rules: readonly BuilderRule[])}
	<ul class="list" data-testid="rule-list">
		{#each rules as r (r.key)}
			<li>
				<button type="button" class="pick" data-rule={r.key} onclick={() => pick(r.key)}>
					<span class="name">{r.label}</span>
					<span class="about">{r.description}</span>
				</button>
			</li>
		{:else}
			<li class="none">{t('common.none')}</li>
		{/each}
	</ul>
{/snippet}

<Dialog
	bind:open
	title={editing ? t('character-builder.editRuleTitle') : t('character-builder.addRuleTitle')}
	size="full"
>
	{#if finding}
		<div class="find" data-testid="rule-dialog">
			<SearchField
				label={t('character-builder.findRule')}
				bind:value={query}
				testid="rule-search"
			/>
			{#if query.trim()}
				{@render ruleList(found)}
			{:else}
				<Tabs bind:value={group} tabs={groupTabs} label={t('character-builder.ruleGroups')} dense>
					{#snippet panel(tab)}
						{@render ruleList(available.filter((r) => r.group === tab))}
					{/snippet}
				</Tabs>
			{/if}
		</div>
	{:else}
		<div class="rule" data-testid="rule-dialog">
			{#if editing}
				<div class="chosen">
					<span class="name">{rule?.label}</span>
					<span class="about">{rule?.description || t('common.none')}</span>
				</div>
			{:else}
				<button
					type="button"
					class="pick chosen"
					data-testid="rule-pick"
					aria-label={t('character-builder.otherRule', { rule: rule?.label ?? '' })}
					onclick={() => (finding = true)}
				>
					<span class="name">{rule?.label}</span>
					<span class="about">{rule?.description || t('common.none')}</span>
				</button>
			{/if}
			<Toggle
				label={t('character-builder.rulesText')}
				checked={asText}
				disabled={!rule || (asText && !backToFields)}
				onChange={setText}
			/>
			{#if rule && asText}
				<TextField
					label={t('character-builder.rulesText')}
					hideLabel
					multiline
					rows={8}
					bind:value={rulesText}
					testid="rule-json"
				/>
			{:else if rule}
				<div class="settings" data-testid="rule-settings">
					<RuleValueField
						spec={rule.field}
						{value}
						onchange={(v) => (value = v)}
						label={rule.label}
						{reminders}
						{characters}
						top
					/>
				</div>
			{/if}
			<!-- Reserved room at the foot: problems come and go as it is typed, so nothing moves. -->
			<ul class="problems" role="status" data-testid="rule-problems">
				{#each problems as problem (problem)}
					<li>{problem}</li>
				{/each}
			</ul>
		</div>
	{/if}
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={save}
			disabled={!read || 'error' in read || problems.length > 0}
		/>
	{/snippet}
</Dialog>

<style>
	.rule {
		display: grid;
		gap: var(--space-3);
	}
	.find {
		display: grid;
		gap: var(--space-2);
	}
	.list {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.list > li + li {
		border-top: thin solid var(--border);
	}
	.none {
		padding-block: var(--space-2);
	}
	.pick {
		display: grid;
		gap: var(--space-1);
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2) 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: start;
		cursor: pointer;
	}
	.chosen {
		display: grid;
		gap: var(--space-1);
	}
	.chosen.pick {
		padding-inline: var(--space-2);
		border: thin solid var(--border);
		border-radius: var(--radius-md);
	}
	.name {
		font-weight: 600;
	}
	.about {
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	.settings {
		display: grid;
		gap: var(--space-3);
	}
	.problems {
		display: grid;
		gap: var(--space-1);
		min-height: 2lh;
		margin: 0;
		padding-inline-start: 1.2em;
		font-size: 0.9rem;
		color: var(--evil-text);
		overflow-wrap: anywhere;
	}
</style>

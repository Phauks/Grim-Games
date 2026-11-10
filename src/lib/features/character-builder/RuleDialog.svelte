<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, ReminderLabel } from '#lib/core/data/index.ts';
	import {
		BUILDER_RULES,
		builderRule,
		startFor,
		fitsFields,
		readRuleText,
		ruleProblems,
		ruleText,
		type BuilderRule,
		type CharacterFields
	} from '#lib/core/rules/index.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import RuleValueField from './RuleValueField.svelte';

	/**
	 * Adds one rule to a custom character, or changes one it has (M62, Trevor picked "Add a
	 * rule", 2026-11-09). Like Add a setup change: the rule is picked from a drop-down with its
	 * description, then its settings are filled in with fields made for that rule
	 * (`RuleValueField`). "Rules text" writes the same rule as text instead, and is where a rule
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
		const first = available[0]?.key ?? '';
		untrack(() => (start ? load(start.key, start.value) : load(first, undefined)));
	});

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

	const ruleOptions = $derived(
		available.map((r) => ({ value: r.key, label: r.label, description: r.description }))
	);

	function save() {
		if (!read || 'error' in read || problems.length) return;
		onSave(key, read.value);
		open = false;
	}
</script>

<Dialog
	bind:open
	title={editing ? t('character-builder.editRuleTitle') : t('character-builder.addRuleTitle')}
	size="full"
>
	<div class="rule" data-testid="rule-dialog">
		<Select
			label={t('character-builder.rule')}
			value={key}
			options={ruleOptions}
			disabled={!!editing}
			placeholder={t('common.none')}
			testid="rule-pick"
			onChange={(next: string) => load(next, undefined)}
		/>
		<p class="description">{rule?.description || t('common.none')}</p>
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
	.description {
		margin: 0;
		font-style: italic;
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

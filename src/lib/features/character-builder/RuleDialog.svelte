<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { ReminderLabel } from '#lib/core/data/index.ts';
	import {
		BUILDER_RULES,
		builderRule,
		readRuleText,
		ruleProblems,
		ruleText,
		type BuilderRule,
		type CharacterFields
	} from '#lib/core/rules/index.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';

	/**
	 * Adds one rule to a custom character, or changes one it has (M62, Trevor picked "Add a
	 * rule", 2026-11-09). Like Add a setup change: the rule is picked from a drop-down with its
	 * description, and every control is always there with only the one the rule uses enabled,
	 * so choosing a different rule moves nothing. A rule with several settings is written as
	 * its rules text until it gets fields of its own.
	 */
	interface Props {
		open: boolean;
		fields: CharacterFields;
		/** The rule being changed; absent: a new rule. */
		editing?: { key: string; value: unknown };
		onSave: (key: string, value: unknown) => void;
	}

	let { open = $bindable(), fields, editing, onSave }: Props = $props();

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
	let on = $state(true);
	let choice = $state<string>();
	let count = $state(1);
	let text = $state('');
	let rulesText = $state('');

	const rule = $derived<BuilderRule | undefined>(key ? builderRule(key) : undefined);
	const kind = $derived(rule?.field?.kind ?? 'text');
	const choices = $derived(
		rule?.field?.kind === 'enum'
			? rule.field.values
			: rule?.field?.kind === 'token'
				? reminders
				: []
	);

	/** The controls set to `value` as the rule `next` reads it. */
	function load(next: string, value: unknown) {
		key = next;
		const field = builderRule(next).field;
		on = typeof value === 'boolean' ? value : true;
		count = typeof value === 'number' ? value : 1;
		text = field?.kind === 'string' && typeof value === 'string' ? value : '';
		const options =
			field?.kind === 'enum' ? field.values : field?.kind === 'token' ? reminders : [];
		choice = typeof value === 'string' && options.includes(value) ? value : options[0];
		rulesText = field ? '' : ruleText(value);
	}

	$effect(() => {
		if (!open) return;
		if (editing) load(editing.key, editing.value);
		else load(available[0]?.key ?? '', undefined);
	});

	const read = $derived.by((): { value: unknown } | { error: string } | undefined => {
		if (!rule) return undefined;
		switch (kind) {
			case 'true':
				return { value: true };
			case 'boolean':
				return { value: on };
			case 'count':
				return { value: count };
			case 'string':
				return text.trim() ? { value: text.trim() } : undefined;
			case 'enum':
			case 'token':
				return choice === undefined ? undefined : { value: choice };
		}
		return rulesText.trim() ? readRuleText(rulesText) : undefined;
	});

	const problems = $derived.by((): string[] => {
		if (!read) return [];
		if ('error' in read) return [read.error];
		return ruleProblems(fields, key, read.value, reminders);
	});

	const ruleOptions = $derived(
		available.map((r) => ({ value: r.key, label: r.label, description: r.description }))
	);
	const choiceOptions = $derived(choices.map((value) => ({ value, label: value })));

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
			label={t('character-builder.ruleOn')}
			checked={kind === 'boolean' ? on : kind === 'true'}
			disabled={kind !== 'boolean'}
			onChange={(value) => (on = value)}
		/>
		<Select
			label={t('character-builder.ruleValue')}
			value={kind === 'enum' || kind === 'token' ? choice : undefined}
			options={choiceOptions}
			disabled={kind !== 'enum' && kind !== 'token'}
			placeholder={t('common.none')}
			testid="rule-value"
			onChange={(value: string) => (choice = value)}
		/>
		<div class="number">
			<span class="label" aria-hidden="true">{t('character-builder.number')}</span>
			<NumberSelect
				bind:value={count}
				min={1}
				max={20}
				label={t('character-builder.number')}
				hideLabel
				disabled={kind !== 'count'}
				testid="rule-count"
			/>
		</div>
		<TextField
			label={t('character-builder.setupText')}
			bind:value={text}
			disabled={kind !== 'string'}
			testid="rule-text"
		/>
		<TextField
			label={t('character-builder.rulesText')}
			multiline
			rows={6}
			bind:value={rulesText}
			disabled={kind !== 'text'}
			testid="rule-json"
		/>
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
	.number {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.label {
		font-weight: 600;
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

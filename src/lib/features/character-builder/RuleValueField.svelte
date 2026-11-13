<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character } from '#lib/core/data/index.ts';
	import {
		emptyFor,
		optionLabel,
		settingLabel,
		startFor,
		startVariant,
		variantOf,
		type FieldSpec
	} from '#lib/core/data/field-spec.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterPiece from '#lib/features/characters/CharacterPiece.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import TextListField from '#lib/ui/primitives/TextListField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import RuleValueField from './RuleValueField.svelte';

	/**
	 * One setting of a rule, drawn from its field description (`field-spec.ts`, M62): a switch,
	 * a drop-down, a number or text, a list of them, or a group of settings, each drawn the same
	 * way. Every setting an object has is always there, so filling one in moves nothing; one
	 * left empty is left out of the rule.
	 */
	interface Props {
		spec: FieldSpec;
		value: unknown;
		onchange: (value: unknown) => void;
		label: string;
		/** It may be left out: empty means not set. */
		optional?: boolean;
		/** The character's own reminders, for a setting naming one. */
		reminders: readonly string[];
		/** Characters a setting naming one may pick (a jinx's partner). */
		characters: readonly Character[];
		/** The rule itself, whose settings are not set apart as a group. */
		top?: boolean;
	}

	let {
		spec,
		value,
		onchange,
		label,
		optional = false,
		reminders,
		characters,
		top = false
	}: Props = $props();

	type Rec = Record<string, unknown>;
	const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
	const rec = (v: unknown): Rec => (isRec(v) ? v : {});
	const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
	const strings = (v: unknown): string[] =>
		arr(v).filter((x): x is string => typeof x === 'string');

	const choices = (values: readonly string[]) =>
		values.map((v) => ({ value: v, label: optionLabel(v, spec.names) }));

	/** The setting's help line in plain words (M81), marked when it may be left out. */
	const help = $derived(
		spec.about
			? optional
				? t('character-builder.optionalHelp', { help: spec.about })
				: spec.about
			: ''
	);
	/** A switch shows its help beside it; every other setting under it. */
	/** A group of settings shows its help under its name. */
	const grouped = $derived(
		['variants', 'object', 'list', 'byToken', 'byKey', 'byCharacter'].includes(spec.kind)
	);
	const switched = $derived(spec.kind === 'true' || (spec.kind === 'boolean' && !optional));
	const tokenChoices = $derived(reminders.map((r) => ({ value: r, label: r })));

	/** A list or group emptied out is left out when it may be. */
	const settle = (v: unknown) => {
		if (!optional) return v;
		if (Array.isArray(v) && !v.length) return undefined;
		if (isRec(v) && !Object.keys(v).length) return undefined;
		return v;
	};

	function setKey(key: string, v: unknown) {
		const next = { ...rec(value) };
		if (v === undefined) delete next[key];
		else next[key] = v;
		onchange(settle(next));
	}

	/** The entries with entry `i` renamed to `key`, in their order. */
	function renameKey(i: number, key: string) {
		const entries = Object.entries(rec(value));
		if (entries.some(([k], j) => k === key && j !== i)) return;
		onchange(Object.fromEntries(entries.map(([k, v], j) => [j === i ? key : k, v])));
	}

	function removeKey(key: string) {
		const next = { ...rec(value) };
		delete next[key];
		onchange(settle(next));
	}

	function setItem(i: number, v: unknown) {
		onchange(arr(value).map((x, j) => (j === i ? v : x)));
	}

	/** A number as typed: empty is unset, anything else not a number is kept for its check. */
	function number(text: string): unknown {
		const trimmed = text.trim();
		if (!trimmed) return undefined;
		const n = Number(trimmed);
		return Number.isFinite(n) ? n : trimmed;
	}

	/** "1, -2" as numbers. */
	function numbers(text: string): unknown {
		const parts = text.split(/[\s,]+/).filter(Boolean);
		return settle(parts.map((p) => (Number.isFinite(Number(p)) ? Number(p) : p)));
	}

	const characterOf = (id: string) => characters.find((c) => c.id === id);

	/** Which character the picker is open for: the setting itself, or entry `i`'s key. */
	let picking = $state<{ entry?: number }>({});
	let pickerOpen = $state(false);

	function pick(at: { entry?: number }) {
		picking = at;
		pickerOpen = true;
	}

	function picked(id: string) {
		const at = picking;
		pickerOpen = false;
		if (at.entry === undefined) onchange(id);
		else if (at.entry >= 0) renameKey(at.entry, id);
		else if (!(id in rec(value)) && spec.kind === 'byCharacter')
			onchange({ ...rec(value), [id]: startFor(spec.of) });
	}

	let jsonText = $state('');
	$effect.pre(() => {
		if (spec.kind === 'text') jsonText = value === undefined ? '' : JSON.stringify(value, null, 2);
	});
	function setJson(text: string) {
		jsonText = text;
		if (!text.trim()) return onchange(undefined);
		try {
			onchange(JSON.parse(text));
		} catch {
			onchange(text);
		}
	}
</script>

{#if spec.kind === 'true'}
	{#if optional}
		<Toggle
			{label}
			description={help || undefined}
			checked={value === true}
			onChange={(on) => onchange(on ? true : undefined)}
		/>
	{/if}
{:else if spec.kind === 'boolean'}
	{#if optional}
		<Select
			{label}
			value={value === true ? 'on' : value === false ? 'off' : undefined}
			options={[
				{ value: 'on', label: t('character-builder.ruleIsOn') },
				{ value: 'off', label: t('character-builder.ruleIsOff') }
			]}
			placeholder={t('common.none')}
			onClear={() => onchange(undefined)}
			onChange={(v: string) => onchange(v === 'on')}
		/>
	{:else}
		<Toggle
			{label}
			description={help || undefined}
			checked={value === true}
			onChange={(on) => onchange(on)}
		/>
	{/if}
{:else if spec.kind === 'count' || spec.kind === 'number' || spec.kind === 'integer'}
	<TextField
		{label}
		inputmode={spec.kind === 'integer' ? 'text' : 'numeric'}
		value={value === undefined ? '' : String(value)}
		oninput={(text) => onchange(number(text))}
	/>
{:else if spec.kind === 'string'}
	<TextField
		{label}
		value={typeof value === 'string' ? value : ''}
		oninput={(text) => onchange(text === '' && optional ? undefined : text)}
	/>
{:else if spec.kind === 'token' || spec.kind === 'enum'}
	<Select
		{label}
		value={typeof value === 'string' ? value : undefined}
		options={spec.kind === 'token' ? tokenChoices : choices(spec.values)}
		placeholder={t('common.none')}
		onClear={optional ? () => onchange(undefined) : undefined}
		onChange={(v: string) => onchange(v)}
	/>
{:else if spec.kind === 'enums' || spec.kind === 'tokens'}
	<Select
		{label}
		multiple
		values={strings(value)}
		options={spec.kind === 'tokens' ? tokenChoices : choices(spec.values)}
		placeholder={t('common.none')}
		onValuesChange={(values: string[]) => onchange(settle(values))}
	/>
{:else if spec.kind === 'strings'}
	<TextListField
		{label}
		values={strings(value)}
		onChange={(values) => onchange(settle(values))}
		rowLabel={(number) => `${label} ${number}`}
		removeLabel={(number) => t('character-builder.removeSetting', { label, number })}
		addLabel={t('character-builder.addSetting', { label })}
	/>
{:else if spec.kind === 'numbers'}
	<TextField {label} value={arr(value).join(', ')} oninput={(text) => onchange(numbers(text))} />
{:else if spec.kind === 'text'}
	<TextField {label} multiline rows={4} value={jsonText} oninput={setJson} />
{:else if spec.kind === 'variants'}
	{@const index = variantOf(spec, value)}
	<fieldset class:group={!top}>
		{#if !top}<legend>{label}</legend>{/if}
		{#if help}<p class="help group-help">{help}</p>{/if}
		<Select
			label={t('character-builder.ruleShape', { label })}
			value={index < 0 ? undefined : String(index)}
			options={spec.variants.map((v, i) => ({ value: String(i), label: v.label }))}
			placeholder={t('common.none')}
			onClear={optional ? () => onchange(undefined) : undefined}
			onChange={(i: string) => onchange(startVariant(spec.variants[Number(i)]!))}
		/>
		{#if index >= 0}
			<RuleValueField
				spec={spec.variants[index]!.spec}
				{value}
				{onchange}
				{label}
				{reminders}
				{characters}
				top
			/>
		{/if}
	</fieldset>
{:else if spec.kind === 'object' && spec.pick}
	{@const set = spec.fields.filter((f) => rec(value)[f.key] !== undefined)}
	{@const unset = spec.fields.filter((f) => rec(value)[f.key] === undefined)}
	<fieldset class:group={!top}>
		<legend class:visually-hidden={top}>{label}</legend>
		{#if help}<p class="help group-help">{help}</p>{/if}
		{#each set as field, i (field.key)}
			<div class="entry">
				<div class="entry-head">
					<span>{settingLabel(field)}</span>
					<DeleteButton
						label={t('character-builder.removeSetting', {
							label: settingLabel(field),
							number: i + 1
						})}
						onclick={() => removeKey(field.key)}
					/>
				</div>
				<RuleValueField
					spec={field.spec}
					value={rec(value)[field.key]}
					onchange={(v) => setKey(field.key, v ?? startFor(field.spec))}
					label={settingLabel(field)}
					{reminders}
					{characters}
					top
				/>
			</div>
		{/each}
		<Select
			label={t('character-builder.addSetting', { label })}
			value={undefined}
			options={unset.map((f) => ({ value: f.key, label: settingLabel(f) }))}
			placeholder={t('common.none')}
			disabled={!unset.length}
			onChange={(key: string) => {
				const field = unset.find((f) => f.key === key);
				if (field) setKey(key, startFor(field.spec));
			}}
		/>
	</fieldset>
{:else if spec.kind === 'object'}
	<fieldset class:group={!top}>
		{#if !top}<legend>{label}</legend>{/if}
		{#if help}<p class="help group-help">{help}</p>{/if}
		{#each spec.fields as field (field.key)}
			<RuleValueField
				spec={field.spec}
				value={rec(value)[field.key]}
				onchange={(v) => setKey(field.key, v)}
				label={settingLabel(field)}
				optional={field.optional}
				{reminders}
				{characters}
			/>
		{/each}
	</fieldset>
{:else if spec.kind === 'list'}
	<fieldset class:group={!top}>
		<legend class:visually-hidden={top}>{label}</legend>
		{#if help}<p class="help group-help">{help}</p>{/if}
		{#each arr(value) as item, i (i)}
			{@const name = `${label} ${i + 1}`}
			<div class="entry">
				<div class="entry-head">
					<span>{name}</span>
					<DeleteButton
						label={t('character-builder.removeSetting', { label, number: i + 1 })}
						onclick={() => onchange(settle(arr(value).filter((_, j) => j !== i)))}
					/>
				</div>
				<RuleValueField
					spec={spec.of}
					value={item}
					onchange={(v) => setItem(i, v)}
					label={name}
					{reminders}
					{characters}
					top
				/>
			</div>
		{/each}
		<div class="add">
			<Button
				variant="quiet"
				icon="add"
				onclick={() => onchange([...arr(value), emptyFor(spec.of)])}
				>{t('character-builder.addSetting', { label })}</Button
			>
		</div>
	</fieldset>
{:else if spec.kind === 'byToken' || spec.kind === 'byKey'}
	{@const entries = Object.entries(rec(value))}
	{@const unused = reminders.filter((r) => !(r in rec(value)))}
	<fieldset class:group={!top}>
		<legend class:visually-hidden={top}>{label}</legend>
		{#if help}<p class="help group-help">{help}</p>{/if}
		{#each entries as [key, item], i (i)}
			<div class="entry">
				<div class="entry-head">
					{#if spec.kind === 'byToken'}
						<Select
							label={t('character-builder.ruleReminder', { label })}
							hideLabel
							value={key}
							options={tokenChoices}
							onChange={(k: string) => renameKey(i, k)}
						/>
					{:else}
						<TextField
							label={t('character-builder.ruleKey', { label })}
							hideLabel
							value={key}
							oninput={(k) => renameKey(i, k)}
						/>
					{/if}
					<DeleteButton
						label={t('character-builder.removeSetting', { label, number: i + 1 })}
						onclick={() => removeKey(key)}
					/>
				</div>
				<RuleValueField
					spec={spec.of}
					value={item}
					onchange={(v) => setKey(key, v ?? emptyFor(spec.of))}
					label={key || label}
					{reminders}
					{characters}
					top
				/>
			</div>
		{/each}
		<div class="add">
			<Button
				variant="quiet"
				icon="add"
				disabled={spec.kind === 'byToken' ? !unused.length : '' in rec(value)}
				onclick={() =>
					onchange({
						...rec(value),
						[spec.kind === 'byToken' ? unused[0]! : '']: emptyFor(spec.of)
					})}>{t('character-builder.addSetting', { label })}</Button
			>
		</div>
	</fieldset>
{:else if spec.kind === 'character'}
	<div class="character">
		<span class="label">{label}</span>
		<Button variant="field" onclick={() => pick({})}>{t('character-builder.chooseLinked')}</Button>
		{#if typeof value === 'string' && value}
			<CharacterPiece template="badge" characterId={value} character={characterOf(value)} />
		{:else}
			<span class="muted">{t('common.none')}</span>
		{/if}
	</div>
{:else if spec.kind === 'byCharacter'}
	<fieldset class:group={!top}>
		<legend class:visually-hidden={top}>{label}</legend>
		{#if help}<p class="help group-help">{help}</p>{/if}
		{#each Object.entries(rec(value)) as [key, item], i (key)}
			{@const name = characterOf(key)?.name ?? key}
			<div class="entry">
				<div class="entry-head">
					<Button
						variant="field"
						aria-label={t('character-builder.changeCharacter', { name })}
						onclick={() => pick({ entry: i })}
					>
						<CharacterPiece template="badge" characterId={key} character={characterOf(key)} />
					</Button>
					<DeleteButton
						label={t('character-builder.removeSetting', { label: name, number: i + 1 })}
						onclick={() => removeKey(key)}
					/>
				</div>
				<RuleValueField
					spec={spec.of}
					value={item}
					onchange={(v) => setKey(key, v ?? emptyFor(spec.of))}
					label={name}
					{reminders}
					{characters}
					top
				/>
			</div>
		{/each}
		<div class="add">
			<Button variant="quiet" icon="add" onclick={() => pick({ entry: -1 })}
				>{t('character-builder.addSetting', { label })}</Button
			>
		</div>
	</fieldset>
{/if}

{#if spec.kind === 'character' || spec.kind === 'byCharacter'}
	<Dialog bind:open={pickerOpen} title={t('character-builder.chooseLinked')} size="full">
		<CharacterPicker
			{characters}
			selected={typeof value === 'string' ? [value] : Object.keys(rec(value))}
			onSelect={picked}
		/>
	</Dialog>
{/if}
{#if help && !switched && !grouped}
	<p class="help">{help}</p>
{/if}

<style>
	.help {
		margin: 0;
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
	fieldset {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
	}
	.group {
		padding-inline-start: var(--space-3);
		border-inline-start: 2px solid var(--border); /* px-ok: a hairline group edge */
	}
	legend {
		padding: 0;
		margin-bottom: var(--space-2);
		font-family: var(--font-control);
		font-weight: 600;
	}
	.entry {
		display: grid;
		gap: var(--space-2);
		padding-block: var(--space-2);
		border-top: 1px solid var(--border);
	}
	.entry-head {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		font-weight: 600;
	}
	.add {
		justify-self: start;
	}
	.label {
		flex-basis: 100%;
		font-family: var(--font-control);
		font-weight: 600;
	}
	.character {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>

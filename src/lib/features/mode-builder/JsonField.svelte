<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import TextField from '#lib/ui/primitives/TextField.svelte';

	/**
	 * A field whose shape has no control of its own yet (core/modes/builder.ts JSON_TYPES),
	 * written as JSON, so every part of the format can be reached from the builder. The file
	 * changes once what is typed reads as JSON; empty leaves the field out.
	 */
	interface Props {
		label: string;
		value: unknown;
		onChange: (value: unknown) => void;
		disabled?: boolean;
	}

	let { label, value, onChange, disabled = false }: Props = $props();

	const shown = (v: unknown) => (v === undefined ? '' : JSON.stringify(v));
	let typed = $state('');
	let bad = $state(false);
	// Follows the file when it changes elsewhere (another mode opened), not while typing.
	$effect(() => {
		const next = shown(value);
		untrack(() => {
			if (!bad && same(typed, next)) return;
			if (!bad || typed.trim() === '') typed = next;
		});
	});
	function same(text: string, json: string) {
		try {
			return JSON.stringify(text.trim() ? JSON.parse(text) : undefined) === (json || undefined);
		} catch {
			return false;
		}
	}

	function input(text: string) {
		typed = text;
		if (text.trim() === '') {
			bad = false;
			onChange(undefined);
			return;
		}
		try {
			onChange(JSON.parse(text));
			bad = false;
		} catch {
			bad = true;
		}
	}
</script>

<TextField
	label={t('modes.builder.json', { field: label })}
	hideLabel
	multiline
	rows={2}
	spellcheck={false}
	{disabled}
	invalid={bad}
	value={typed}
	oninput={input}
/>

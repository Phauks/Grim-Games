<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import ClearableField from './ClearableField.svelte';

	/**
	 * A labelled text field: the label above, the field under it at full width. Single-line
	 * fields have the clear X (ClearableField) and commit on Enter, which also closes a
	 * phone's keyboard (Trevor's UI rules); Enter while an input method is composing is left
	 * alone. `multiline` is a textarea, where Enter is a new line.
	 *
	 * One field for every form (component review §4.2, 2026-10-17): nine features had their
	 * own `.field` label, input styles and Enter handler.
	 */
	interface Props {
		label: string;
		value?: string;
		multiline?: boolean;
		/** Visible rows of a multi-line field. */
		rows?: number;
		type?: 'text' | 'url' | 'email' | 'search' | 'password';
		inputmode?: HTMLInputAttributes['inputmode'];
		/** Off by default in a single-line field; `email` or `one-time-code` where the browser can fill it in. */
		autocomplete?: HTMLInputAttributes['autocomplete'];
		/** The phone keyboard's Enter key; `done` by default. */
		enterkeyhint?: HTMLInputAttributes['enterkeyhint'];
		/** Off for text that isn't words, such as pasted JSON. */
		spellcheck?: boolean;
		/** A multi-line field that fills the height its parent gives it, instead of `rows`. */
		grow?: boolean;
		placeholder?: string;
		maxlength?: number;
		required?: boolean;
		disabled?: boolean;
		invalid?: boolean;
		/** The label is read out but not shown (the field's purpose is clear from where it is). */
		hideLabel?: boolean;
		/** Enter in a single-line field; it blurs the field afterwards unless this returns false. */
		oncommit?: () => boolean | void;
		oninput?: (value: string) => void;
		/** A single-line field's one extra icon button, just before its X (ClearableField `end`). */
		end?: Snippet;
		testid?: string;
	}

	let {
		label,
		value = $bindable(''),
		multiline = false,
		rows = 3,
		type = 'text',
		inputmode,
		autocomplete,
		enterkeyhint = 'done',
		spellcheck,
		grow = false,
		placeholder,
		maxlength,
		required = false,
		disabled = false,
		invalid = false,
		hideLabel = false,
		oncommit,
		oninput,
		end,
		testid
	}: Props = $props();

	function onkeydown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.key !== 'Enter' || event.isComposing) return;
		event.preventDefault();
		if (oncommit?.() !== false) event.currentTarget.blur();
	}
</script>

<label class={['text-field', grow && multiline && 'grow']}>
	<span class={hideLabel ? 'visually-hidden' : 'label'}>{label}</span>
	{#if multiline}
		<textarea
			bind:value
			{rows}
			{placeholder}
			{spellcheck}
			{autocomplete}
			{maxlength}
			{required}
			{disabled}
			aria-invalid={invalid || undefined}
			data-testid={testid}
			oninput={(e) => oninput?.(e.currentTarget.value)}></textarea>
	{:else}
		<ClearableField bind:value {disabled} {end} onclear={() => oninput?.('')}>
			<input
				bind:value
				{type}
				{inputmode}
				{placeholder}
				{maxlength}
				{required}
				{disabled}
				autocomplete={autocomplete ?? 'off'}
				{enterkeyhint}
				{spellcheck}
				aria-invalid={invalid || undefined}
				data-testid={testid}
				{onkeydown}
				oninput={(e) => oninput?.(e.currentTarget.value)}
			/>
		</ClearableField>
	{/if}
</label>

<style>
	.text-field {
		display: grid;
		gap: var(--space-1);
		min-width: 0;
		font-family: var(--font-control);
	}
	.label {
		color: var(--on-surface-muted);
	}
	input,
	textarea {
		box-sizing: border-box;
		width: 100%;
		min-width: 0;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: var(--font-control);
		/* iOS zooms into fields under 16px. */
		font-size: max(1rem, 16px); /* px-ok: iOS zooms into fields under 16px */
	}
	textarea {
		resize: vertical;
		font-family: var(--font-body);
	}
	/* The textarea takes the rest of the height the field is given. */
	.grow {
		grid-template-rows: auto 1fr;
	}
	.grow textarea {
		height: 100%;
		resize: none;
	}
	[aria-invalid='true'] {
		border-color: var(--evil);
	}
	:disabled {
		opacity: 0.5;
	}
</style>

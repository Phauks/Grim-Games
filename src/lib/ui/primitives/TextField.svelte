<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		afterLineBreak,
		listAt,
		toggleList,
		type ListKind,
		type TextEdit
	} from '#lib/core/text/lists.ts';
	import ClearableField from './ClearableField.svelte';
	import IconButton from './IconButton.svelte';

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
		/**
		 * A multi-line field with no resize grip that grows with its text from `rows` up, and
		 * scrolls past most of the screen's height (seat notes: Trevor, 2026-10-19).
		 */
		autogrow?: boolean;
		/**
		 * A multi-line field with Bulleted and Numbered list buttons beside its label, and Enter
		 * carrying a list on (notes: Trevor, 2026-10-30). The list is the text itself ("• ",
		 * "1. "), `core/text/lists.ts`.
		 */
		lists?: boolean;
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
		/** Keeps only what it returns as the field is typed in (numbers: digits only). */
		filter?: (value: string) => string;
		/** A single-line field's one extra icon button, just before its X (ClearableField `end`). */
		end?: Snippet;
		testid?: string;
		/**
		 * The label and the value in the account font (plain by default), for what people must
		 * read and type exactly (sign-in details: Trevor, 2026-10-18).
		 */
		plain?: boolean;
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
		autogrow = false,
		lists = false,
		placeholder,
		maxlength,
		required = false,
		disabled = false,
		invalid = false,
		hideLabel = false,
		oncommit,
		oninput,
		filter,
		end,
		testid,
		plain = false
	}: Props = $props();

	/*
	 * A password is masked, with an eye button that shows it (Trevor, 2026-10-22: "password
	 * field should have eyeball"), so a glance at the screen doesn't give it away.
	 */
	let revealed = $state(false);
	const inputType = $derived(type === 'password' && revealed ? 'text' : type);

	let area = $state<HTMLTextAreaElement>();
	$effect(() => {
		void value;
		if (!autogrow || !area) return;
		// Back to `rows` first, so deleting text shrinks it again.
		area.style.height = '';
		const border = area.offsetHeight - area.clientHeight;
		area.style.height = `${Math.max(area.scrollHeight + border, area.offsetHeight)}px`;
	});

	/** The list the caret's line is in, so its button shows as on. */
	let caretList = $state<ListKind>();
	function readCaret() {
		if (area) caretList = listAt(area.value, area.selectionStart);
	}

	/**
	 * Puts an edit into the textarea as typing would (`insertText`), so the browser's undo
	 * takes it back and `input` updates `value`; set directly where a browser can't.
	 */
	function apply(edit: TextEdit) {
		if (!area) return;
		const before = area.value;
		let from = 0;
		while (from < before.length && before[from] === edit.text[from]) from++;
		let tail = 0;
		while (
			tail < before.length - from &&
			tail < edit.text.length - from &&
			before[before.length - 1 - tail] === edit.text[edit.text.length - 1 - tail]
		)
			tail++;
		const insert = edit.text.slice(from, edit.text.length - tail);
		area.setSelectionRange(from, before.length - tail);
		const typed = document.execCommand(insert ? 'insertText' : 'delete', false, insert);
		if (!typed || area.value !== edit.text) {
			area.value = edit.text;
			value = edit.text;
			oninput?.(edit.text);
		}
		area.setSelectionRange(edit.start, edit.end);
		readCaret();
	}

	function list(kind: ListKind) {
		if (!area || disabled) return;
		area.focus();
		apply(toggleList(area.value, area.selectionStart, area.selectionEnd, kind));
	}

	/*
	 * Enter is read from the `input` it makes rather than its keydown, which a phone's keyboard
	 * often doesn't send as "Enter".
	 */
	function onAreaInput(event: Event & { currentTarget: HTMLTextAreaElement }) {
		const field = event.currentTarget;
		oninput?.(field.value);
		const input = event instanceof InputEvent ? event : undefined;
		const newLine =
			input?.inputType === 'insertLineBreak' ||
			input?.inputType === 'insertParagraph' ||
			(input?.inputType === 'insertText' && input.data === '\n');
		if (lists && newLine && field.selectionStart === field.selectionEnd) {
			const edit = afterLineBreak(field.value, field.selectionStart);
			if (edit) apply(edit);
		}
		if (lists) readCaret();
	}

	function onkeydown(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		if (event.key !== 'Enter' || event.isComposing) return;
		event.preventDefault();
		if (oncommit?.() !== false) event.currentTarget.blur();
	}
</script>

<label
	class={[
		'text-field',
		grow && multiline && 'grow',
		autogrow && multiline && 'autogrow',
		plain && 'plain'
	]}
>
	{#if lists && multiline}
		<!-- The buttons always show, so focusing the field moves nothing (no reflow). -->
		<span class="head">
			<span class={hideLabel ? 'visually-hidden' : 'label'}>{label}</span>
			<span class="list-buttons">
				{@render listButton('bullet', 'bulletList', t('common.bulletList'))}
				{@render listButton('numbered', 'numberedList', t('common.numberedList'))}
			</span>
		</span>
	{:else}
		<span class={hideLabel ? 'visually-hidden' : 'label'}>{label}</span>
	{/if}
	{#if multiline}
		<textarea
			bind:this={area}
			bind:value
			{rows}
			aria-label={lists ? label : undefined}
			{placeholder}
			{spellcheck}
			{autocomplete}
			{maxlength}
			{required}
			{disabled}
			aria-invalid={invalid || undefined}
			data-testid={testid}
			oninput={onAreaInput}
			onkeyup={lists ? readCaret : undefined}
			onpointerup={lists ? readCaret : undefined}
			onfocus={lists ? readCaret : undefined}></textarea>
	{:else}
		<ClearableField
			bind:value
			{disabled}
			end={type === 'password' && !end ? eye : end}
			onclear={() => oninput?.('')}
		>
			<input
				bind:value
				type={inputType}
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
				oninput={(e) => {
					if (filter) {
						const kept = filter(e.currentTarget.value);
						e.currentTarget.value = kept;
						value = kept;
					}
					oninput?.(e.currentTarget.value);
				}}
			/>
		</ClearableField>
	{/if}
</label>

{#snippet listButton(kind: ListKind, icon: 'bulletList' | 'numberedList', name: string)}
	<!-- Pressing it keeps the focus in the field, so a phone's keyboard stays up. -->
	<IconButton
		{icon}
		label={name}
		aria-pressed={caretList === kind}
		{disabled}
		data-list={kind}
		onpointerdown={(e) => e.preventDefault()}
		onclick={() => list(kind)}
	/>
{/snippet}

{#snippet eye()}<IconButton
		icon={revealed ? 'hide' : 'show'}
		label={t('common.showPassword')}
		aria-pressed={revealed}
		{disabled}
		onclick={() => (revealed = !revealed)}
	/>{/snippet}

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
	.head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	/* Full-size tap targets that don't make the label's line taller: the note's text keeps
	   its place above a phone's keyboard (e2e/grimoire.e2e.ts). */
	.list-buttons {
		display: flex;
		gap: var(--space-1);
		margin-left: auto;
		margin-block: calc((1lh - var(--tap-target)) / 2);
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
	.autogrow textarea {
		max-height: 60dvh;
		resize: none;
	}
	.plain,
	.plain input {
		font-family: var(--font-account);
	}
	[aria-invalid='true'] {
		border-color: var(--evil);
	}
	:disabled {
		opacity: 0.5;
	}
</style>

<script lang="ts">
	import ClearableField from './ClearableField.svelte';

	/**
	 * A short code typed one character to a box, like a room code (Trevor, 2026-10-18: "should
	 * limit entry to actual length of join code, and should have individual boxes for each
	 * entry"). One real `<input>` lies over the boxes, so typing moves on to the next box,
	 * Backspace steps back, a pasted or autofilled code fills them all, and screen readers
	 * see one ordinary field. Characters outside `allowed` (spaces, dashes) are dropped and
	 * anything past `length` is cut off. Enter submits the form around it as usual. The X
	 * clears the whole code, like every other text field.
	 */
	interface Props {
		value?: string;
		/** How many characters the code has: that many boxes. */
		length: number;
		/** One character the code may hold; anything else typed or pasted is dropped. */
		allowed?: RegExp;
		/** A wider gap after this many boxes, as the code is shown ("482 913"). */
		group?: number;
		id?: string;
		inputmode?: 'numeric' | 'text';
		/** Accessible name of the X. */
		clearLabel?: string;
	}

	let {
		value = $bindable(''),
		length,
		allowed = /[0-9]/,
		group,
		id,
		inputmode = 'numeric',
		clearLabel
	}: Props = $props();

	let focused = $state(false);
	/** The box the next character goes in; the last one once the code is full. */
	const current = $derived(Math.min(value.length, length - 1));

	function keep(text: string) {
		return [...text]
			.filter((c) => allowed.test(c))
			.join('')
			.slice(0, length);
	}

	function oninput(event: Event & { currentTarget: HTMLInputElement }) {
		const cleaned = keep(event.currentTarget.value);
		if (cleaned !== event.currentTarget.value) event.currentTarget.value = cleaned;
		value = cleaned;
		toEnd(event.currentTarget);
	}

	/** Typing always carries on from the last box, so the caret stays at the end. */
	function toEnd(input: HTMLInputElement) {
		const end = input.value.length;
		if (input.selectionStart !== end || input.selectionEnd !== end) {
			input.setSelectionRange(end, end);
		}
	}
</script>

<ClearableField bind:value label={clearLabel} class="code-field">
	<span class="boxes" aria-hidden="true">
		{#each { length }, i (i)}
			<span
				class="box"
				class:filled={i < value.length}
				class:current={focused && i === current}
				class:group-end={group !== undefined && (i + 1) % group === 0 && i + 1 < length}
				>{value[i] ?? ''}</span
			>
		{/each}
	</span>
	<input
		class="code-input"
		{id}
		{value}
		{inputmode}
		autocomplete="one-time-code"
		autocapitalize="characters"
		spellcheck="false"
		enterkeyhint="go"
		{oninput}
		onfocus={(e) => {
			focused = true;
			toEnd(e.currentTarget);
		}}
		onblur={() => (focused = false)}
		onselect={(e) => toEnd(e.currentTarget)}
		onpointerup={(e) => toEnd(e.currentTarget)}
		onkeyup={(e) => toEnd(e.currentTarget)}
	/>
</ClearableField>

<style>
	/* The boxes and the input over them share the field's one cell, before the X. */
	.boxes {
		grid-area: field;
		display: flex;
		gap: var(--space-2);
		/* Room for the X, which sits at the end of the same cell. */
		padding-inline-end: var(--tap-target);
		min-width: 0;
		pointer-events: none;
	}
	.box {
		display: grid;
		place-items: center;
		/* Narrower on a small screen with large text, so the row never runs off the side. */
		flex: 0 1 calc(2.75 * var(--u));
		min-width: 0;
		height: var(--tap-target);
		box-sizing: border-box;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: var(--font-control);
		font-size: 1.4rem;
		font-variant-numeric: tabular-nums;
	}
	.group-end {
		margin-inline-end: var(--space-2);
	}
	/* The box being typed into carries the field's focus ring. */
	.current {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
		border-color: var(--focus);
	}
	/* As wide as its boxes, so the X sits just after the last one. */
	:global(.clearable.code-field) {
		flex: 0 1 auto;
		justify-self: start;
		width: fit-content;
		max-width: 100%;
		grid-template-columns: minmax(0, 1fr);
	}
	/* The real field: every tap and key lands on it, but only the boxes show. */
	.code-input {
		grid-area: field;
		align-self: stretch;
		width: 100%;
		min-width: 0;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		color: transparent;
		caret-color: transparent;
		/* 1rem or more, so iOS doesn't zoom in on focus. */
		font-size: max(1rem, 16px); /* px-ok: iOS zooms on fields under 16 CSS px */
		cursor: text;
	}
	.code-input::selection {
		background: transparent;
	}
	/* Its ring is drawn on the current box instead. */
	.code-input.code-input:focus-visible {
		outline: none;
	}
</style>

<script lang="ts">
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { SvelteSet } from 'svelte/reactivity';
	import type { DocKind } from './account-protocol.ts';
	import { firstSignIn } from './first-sign-in.svelte.ts';

	/** `t` for the per-kind count keys, which all take `count`. */
	const countOf = (kind: DocKind, count: number) =>
		(t as (key: MessageKey, values: { count: number }) => string)(
			`account.firstSync.${kind}` as MessageKey,
			{ count }
		);

	// Every kind starts on (the plan: all on except player notes, which register switched off).
	const chosen = new SvelteSet<DocKind>();
	let working = $state(false);
	$effect(() => {
		chosen.clear();
		for (const item of firstSignIn.offer?.items ?? []) chosen.add(item.kind);
	});

	/**
	 * Closed any way but Confirm leaves this device's items on the device. Confirm closes the
	 * dialog just before it runs, so the "no" waits a moment and finds Confirm working.
	 */
	function isOpen(): boolean {
		return firstSignIn.offer !== undefined;
	}
	function setOpen(value: boolean): void {
		if (!value) queueMicrotask(() => working || firstSignIn.decline());
	}

	async function confirm(): Promise<void> {
		working = true;
		try {
			await firstSignIn.accept([...chosen]);
		} catch (e) {
			toast(t('account.failed'), e instanceof Error ? e.message : String(e));
		} finally {
			working = false;
		}
	}
</script>

<!-- The first sign-in on this device (sync plan step 2, Trevor 2026-10-18). -->
<ConfirmDialog
	bind:open={isOpen, setOpen}
	title={t('account.firstSync.title')}
	description={t('account.firstSync.text')}
	disabled={working || chosen.size === 0}
	onConfirm={confirm}
>
	{#each firstSignIn.offer?.items ?? [] as item (item.kind)}
		<Toggle
			label={countOf(item.kind, item.count)}
			checked={chosen.has(item.kind)}
			onChange={(on) => (on ? chosen.add(item.kind) : chosen.delete(item.kind))}
		/>
	{/each}
</ConfirmDialog>

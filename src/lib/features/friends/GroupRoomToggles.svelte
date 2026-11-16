<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { groups } from './groups.svelte.ts';

	/**
	 * "Show in {group}" on the Storyteller's room Share (plan F6), one switch for each of
	 * their groups, all off until they turn one on. Members see the game when they open the
	 * group; nobody is sent anything (Trevor, 2026-10-31: "we can't be too spammy").
	 */
	let { code, title }: { code: string | undefined; title: string } = $props();

	/** The groups showing this room; undefined until known. */
	let shown = $state<string[]>();

	$effect(() => {
		shown = undefined;
		if (!code) return;
		const room = code;
		let current = true;
		void groups.load();
		groups
			.room({ room })
			.then((list) => {
				if (current) shown = list;
			})
			.catch(() => {
				// A room just made may not know its Storyteller's account yet.
				if (current) shown = [];
			});
		return () => {
			current = false;
		};
	});

	/**
	 * A switch moves at once and stays enabled while it saves, as Friends can join does (no
	 * dimmed flash, Trevor 2026-11-15). The last tap wins; a failed save puts it back.
	 */
	let saving = 0;
	async function set(group: string, show: boolean): Promise<void> {
		if (!code || !shown) return;
		const before = shown;
		const mine = ++saving;
		shown = show
			? [...before.filter((c) => c !== group), group]
			: before.filter((c) => c !== group);
		try {
			const saved = await groups.room({ room: code, group, show, title });
			if (mine === saving) shown = saved;
		} catch (e) {
			if (mine === saving) shown = before;
			toast(t('friends.failed'), e instanceof Error ? e.message : String(e));
		}
	}
</script>

{#each groups.data ?? [] as group (group.code)}
	<Toggle
		label={t('friends.groups.show', { name: group.name })}
		checked={shown?.includes(group.code) ?? false}
		disabled={shown === undefined}
		onChange={(show) => void set(group.code, show)}
	/>
{/each}

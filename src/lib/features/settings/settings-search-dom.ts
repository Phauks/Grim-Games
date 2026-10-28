import { tick } from 'svelte';
import { duration } from '#lib/ui/motion.ts';
import type { SettingEntry } from './settings-search.ts';

const SETTING = '[data-search-label]';

/**
 * Every searchable setting in `host`, which holds each section's component inside an element
 * with `data-section` (its id) and `data-section-label`.
 */
export function readSettings(host: HTMLElement): SettingEntry[] {
	return [...host.querySelectorAll<HTMLElement>('[data-section]')].flatMap((section) =>
		[...section.querySelectorAll<HTMLElement>(SETTING)].map((el, index) => ({
			section: section.dataset.section ?? '',
			sectionLabel: section.dataset.sectionLabel ?? '',
			label: el.dataset.searchLabel ?? '',
			description: el.dataset.searchDescription || undefined,
			index
		}))
	);
}

/**
 * Brings a found setting into view in its open section: opens any closed group around it,
 * scrolls it to the middle and marks it for a moment (`data-search-hit`) so the eye finds it.
 */
export async function revealSetting(content: HTMLElement, entry: SettingEntry): Promise<void> {
	const all = [...content.querySelectorAll<HTMLElement>(SETTING)];
	const target =
		all[entry.index]?.dataset.searchLabel === entry.label
			? all[entry.index]
			: all.find((el) => el.dataset.searchLabel === entry.label);
	if (!target) return;
	for (let group = target.closest('section.collapsible'); group;) {
		if (!group.hasAttribute('data-open'))
			group.querySelector<HTMLButtonElement>(':scope > .head button[aria-expanded]')?.click();
		group = group.parentElement?.closest('section.collapsible') ?? null;
	}
	await tick();
	target.scrollIntoView({ block: 'center', behavior: duration() ? 'smooth' : 'auto' });
	target.dataset.searchHit = '';
	setTimeout(() => delete target.dataset.searchHit, 2000);
}

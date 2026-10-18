import type { Component } from 'svelte';
import type { Message } from '#lib/i18n/catalog.ts';
import type { IconSlot } from '#lib/ui/icons/catalogue.ts';

/**
 * Settings sections. Any feature can add its own section by calling
 * `registerSettingsSection` when its module loads; the settings modal lists whatever is
 * registered, so adding a section never touches the modal. Build the section's body from
 * the generic rows in `#lib/ui/settings` (SettingRow, SettingChoice, SettingSelect,
 * SettingToggle) so every section looks and behaves the same.
 */
export interface SettingsSection {
	id: string;
	/**
	 * The sidebar and heading text: a catalog message such as `{ key: 'player.settingsTitle' }`,
	 * so it follows the interface language. A plain string is shown as it is (not translated).
	 */
	label: string | Message;
	icon: IconSlot;
	component: Component;
	/** Optional control shown beside the section heading, such as Diagnostics' Refresh icon. */
	headingAction?: Component;
	/**
	 * Puts every setting in this section back to its default, and only those (Trevor,
	 * 2026-10-18); gives the section a reset icon in its heading row, confirmed first.
	 */
	reset?: () => void;
	/** Position in the sidebar, low first. Built-ins use 10, 20, 30 ... and 90 for Reset settings. */
	order: number;
}

let sections: SettingsSection[] = [];

/** Adds a section, or replaces the one with the same id. */
export function registerSettingsSection(section: SettingsSection): void {
	sections = [...sections.filter((s) => s.id !== section.id), section].sort(
		(a, b) => a.order - b.order
	);
}

/** A section label as text, using `say` (from locale.svelte.ts) for catalog messages. */
export function sectionLabel(
	label: SettingsSection['label'],
	say: (message: Message) => string
): string {
	return typeof label === 'string' ? label : say(label);
}

export function settingsSections(): readonly SettingsSection[] {
	return sections;
}

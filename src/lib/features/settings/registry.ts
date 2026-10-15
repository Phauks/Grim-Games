import type { Component } from 'svelte';
import type { IconSlot } from '#lib/ui/icons/catalogue.ts';

/**
 * Settings sections. Any feature can add its own section by calling
 * `registerSettingsSection` when its module loads; the settings modal lists whatever is
 * registered, so adding a section never touches the modal. Build the section's body from
 * the generic rows in `#lib/ui/settings` (SettingRow, SettingChoice, SettingSelect, SettingSegmented,
 * SettingToggle) so every section looks and behaves the same.
 */
export interface SettingsSection {
	id: string;
	label: string;
	icon: IconSlot;
	component: Component;
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

export function settingsSections(): readonly SettingsSection[] {
	return sections;
}

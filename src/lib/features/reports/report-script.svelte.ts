import { untrack } from 'svelte';
import { scriptToJson, type LoadedScript } from '#lib/core/data/index.ts';
import { REPORT_LIMITS } from './reports-protocol.ts';

/**
 * The script a report is sent from (Trevor, 2026-10-22: "if submitting report from a script, we
 * should include the script with it"). Screens that show a script offer it while they are
 * mounted; the Report form takes the one offered last that has a script. Only the script goes,
 * never the game, its players or notes.
 */
type Offer = () => LoadedScript | undefined;

let offers: Offer[] = [];

/**
 * Offers the script `get` returns to reports while the calling component is mounted. Call it
 * during component setup, like `$effect`.
 */
export function offerScriptToReports(get: Offer): void {
	$effect(() => {
		untrack(() => (offers = [...offers, get]));
		return () => {
			offers = offers.filter((offer) => offer !== get);
		};
	});
}

/** The script attached to a report: its name and TPI JSON. */
export interface ReportScript {
	name: string;
	json: string;
}

/** The script a report sent now would carry, if any; undefined when too large to send. */
export function reportScript(): ReportScript | undefined {
	for (let i = offers.length - 1; i >= 0; i--) {
		const script = offers[i]();
		if (!script) continue;
		const json = JSON.stringify(scriptToJson(script));
		if (json.length > REPORT_LIMITS.script) return undefined;
		return { name: script.name, json };
	}
	return undefined;
}

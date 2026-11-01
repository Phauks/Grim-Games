import {
	GAME_MODE_FORMAT,
	GAME_MODE_REVISION,
	GUIDE_INTRO,
	FILE_GUIDE_PARTS,
	GUIDE_TOP,
	MINIMAL_EXAMPLE,
	gameModeById,
	type GuideField
} from '#lib/core/modes/index.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { modeLabel } from './labels.ts';

/**
 * The whole "Writing a mode file" guide as one file to download, Markdown or plain text
 * (Trevor, 2026-10-18), drawn from the same format guide the dialog shows so the two never
 * drift apart.
 */
export type GuideFormat = 'md' | 'txt';

export function guideText(format: GuideFormat): string {
	const md = format === 'md';
	const out: string[] = [];
	const heading = (level: number, text: string) => {
		if (md) out.push(`${'#'.repeat(level)} ${text}`, '');
		else out.push(text, (level === 1 ? '=' : '-').repeat(text.length), '');
	};
	const code = (text: string) => (md ? `\`${text}\`` : text);
	const block = (json: unknown) => {
		const text = JSON.stringify(json, null, 2);
		out.push(...(md ? ['```json', text, '```'] : text.split('\n').map((l) => `    ${l}`)), '');
	};
	const required = (f: GuideField) =>
		f.required ? t('modes.guide.required') : t('modes.guide.optional');
	const values = (f: GuideField) =>
		f.values ? ` ${t('modes.guide.values')} ${f.values.map(code).join(', ')}` : '';
	const fields = (list: GuideField[]) => {
		if (list.length === 0) return;
		if (md) {
			out.push(
				`| ${t('modes.guide.colField')} | ${t('modes.guide.colType')} | ${t('modes.guide.colRequired')} | ${t('modes.guide.colAbout')} |`,
				'| --- | --- | --- | --- |'
			);
			for (const f of list)
				out.push(
					`| ${code(f.name)} | ${f.type} | ${required(f)} | ${(f.about + values(f)).replaceAll('|', '\\|')} |`
				);
		} else {
			for (const f of list)
				out.push(`${f.name} (${f.type}, ${required(f)}): ${f.about}${values(f)}`);
		}
		out.push('');
	};

	heading(1, t('modes.guide.title'));
	out.push(
		t('modes.guide.version', { format: GAME_MODE_FORMAT, revision: GAME_MODE_REVISION }),
		''
	);
	for (const line of GUIDE_INTRO) out.push(line, '');
	heading(2, t('modes.guide.example'));
	block(MINIMAL_EXAMPLE);
	heading(2, t('modes.guide.top'));
	fields(GUIDE_TOP);
	heading(2, t('modes.guide.parts'));
	out.push(t('modes.guide.cite'), '');
	for (const p of FILE_GUIDE_PARTS) {
		heading(3, `${modeLabel('part', p.part)} (${code(p.part)})`);
		out.push(`${p.about} ${p.list ? t('modes.guide.list') : t('modes.guide.object')}`, '');
		fields(p.fields);
		for (const k of p.kinds) {
			out.push(
				md ? `**${code(`"kind": "${k.kind}"`)}**: ${k.about}` : `"kind": "${k.kind}": ${k.about}`,
				''
			);
			fields(k.fields);
		}
	}
	heading(2, t('modes.guide.full'));
	block(gameModeById('whale-buffet'));
	return out.join('\n').trimEnd() + '\n';
}

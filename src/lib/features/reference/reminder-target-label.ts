/**
 * Who a reminder token may go on, in a few words for the Reference (Trevor, 2026-10-18:
 * "who we believe a token could properly be placed upon"). Read from the same curated rules
 * the board uses to show fitting seats (`REMINDER_TARGETS`), so the two never disagree.
 */
import type { CharacterId } from '#lib/core/data/index.ts';
import { REMINDER_TARGETS, type TargetRule } from '#lib/core/rules/reminder-targets.ts';
import { t } from '#lib/i18n/locale.svelte.ts';
import { TYPE_PLURALS } from './labels.ts';

/** The rule's words, or undefined for a token with no rule (homebrew, unlisted labels). */
export function reminderTargetLabel(
	characterId: CharacterId,
	label: string,
	nameOf: (id: CharacterId) => string
): string | undefined {
	const rule = REMINDER_TARGETS[characterId]?.labels[label];
	return rule ? describeTarget(rule, nameOf) : undefined;
}

export function describeTarget(rule: TargetRule, nameOf: (id: CharacterId) => string): string {
	if (rule.global) return t('reference.target.game');
	if (rule.seat === 'self') return t('reference.target.self');

	const adjectives: string[] = [];
	if (rule.life === 'dead') adjectives.push(t('reference.target.dead'));
	if (rule.life === 'alive') adjectives.push(t('reference.target.alive'));
	if (rule.alignment === 'good') adjectives.push(t('reference.target.good'));
	if (rule.alignment === 'evil') adjectives.push(t('reference.target.evil'));

	const or = ` ${t('reference.target.or')} `;
	const noun = rule.characters
		? rule.characters.map(nameOf).join(or)
		: rule.types
			? rule.types.map((type) => TYPE_PLURALS[type]).join(or)
			: undefined;

	const qualifiers: string[] = [];
	const near = rule.neighbour;
	// A neighbour of the character's own player is never that player, so "not self" goes unsaid.
	if (rule.seat === 'other' && near?.of !== 'self') qualifiers.push(t('reference.target.notSelf'));
	if (rule.alignment === 'same') qualifiers.push(t('reference.target.sameAlignment'));
	if (rule.alignment === 'opposite') qualifiers.push(t('reference.target.oppositeAlignment'));
	if (near) {
		const eachSide = near.type !== undefined && near.of === 'self' && !near.ofType;
		if (eachSide) {
			// "Townsfolk, nearest each side" rather than naming the type twice.
			const same = rule.types?.length === 1 && rule.types[0] === near.type;
			qualifiers.push(
				same
					? t('reference.target.nearestEachSide')
					: t('reference.target.nearestTypeEachSide', { type: TYPE_PLURALS[near.type!] })
			);
		} else {
			if (near.type) {
				qualifiers.push(t('reference.target.nearest', { type: TYPE_PLURALS[near.type] }));
			}
			if (near.ofType) {
				qualifiers.push(t('reference.target.nextTo', { label: TYPE_PLURALS[near.ofType] }));
			} else if (near.of === 'self') {
				qualifiers.push(t('reference.target.neighbours'));
			} else {
				qualifiers.push(t('reference.target.nextTo', { label: near.of }));
			}
		}
		if (near.alive) qualifiers.push(t('reference.target.livingOnly'));
	}
	if (rule.withLabel) qualifiers.push(t('reference.target.with', { label: rule.withLabel }));
	if (rule.notWithLabel) {
		qualifiers.push(t('reference.target.notWith', { label: rule.notWithLabel }));
	}

	const head =
		adjectives.length === 0 && noun === undefined
			? t(qualifiers.length ? 'reference.target.players' : 'reference.target.anyPlayer')
			: [...adjectives, noun ?? t('reference.target.playersLower')].join(' ');
	const text = [head, ...qualifiers].join(', ');
	return text[0].toUpperCase() + text.slice(1);
}

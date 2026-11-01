/**
 * Where a Mode builder guide link opens the format guide (`ModeFormatGuide`'s `at`): a
 * section (`top`, `rule-top`, `part:<name>`) and, in it, the field to scroll to.
 */
export interface GuideAt {
	section: string;
	field?: string;
}

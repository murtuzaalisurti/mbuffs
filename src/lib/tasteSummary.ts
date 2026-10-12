// The taste profile marks the titles it names as [[Title]] and its key phrases
// as {{phrase}} (see backend tasteProfileService). These turn that into parts
// the page can style, or back into plain text.

export type TasteSegment = { kind: 'text' | 'title' | 'phrase'; text: string };

const MARKERS = /\[\[(.+?)\]\]|\{\{(.+?)\}\}/g;

export const parseTasteSummary = (summary: string): TasteSegment[] => {
    const segments: TasteSegment[] = [];
    let last = 0;
    for (const match of summary.matchAll(MARKERS)) {
        const index = match.index ?? 0;
        if (index > last) segments.push({ kind: 'text', text: summary.slice(last, index) });
        segments.push(match[1] !== undefined ? { kind: 'title', text: match[1] } : { kind: 'phrase', text: match[2] });
        last = index + match[0].length;
    }
    if (last < summary.length) segments.push({ kind: 'text', text: summary.slice(last) });
    return segments;
};

export const plainTasteSummary = (summary: string) => summary.replace(MARKERS, (_match, title?: string, phrase?: string) => title ?? phrase ?? '');

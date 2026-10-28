import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { CatalogClause, CatalogRequirement, CatalogStandard, InstrumentCatalog } from './types';
import { explicitShallSentences, collapseWhitespace } from './text-utils';

const STANDARD_KEY = 'act:india:dpdp:2023:22';
const ACT_URL = 'https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf';
const CITATION_URL = 'https://www.indiacode.nic.in/bitstream/123456789/22037/2/a2023-22.pdf';
const NOTICE_URL = 'https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf';
const EDITION = 'Act No. 22 of 2023; Gazette CG-DL-E-12082023-248045; MeitY PDF retrieved 2026-10-28';
const PROVENANCE =
  'Text extracted with pdftotext -layout from the MeitY-hosted gazette PDF of the Digital Personal Data Protection Act, 2023. India Code PDF timed out. Commencement is taken only from G.S.R. 843(E).';

function sourceDir(): string {
  const candidates = [
    join(__dirname, 'sources'),
    join(process.cwd(), 'src/regulatory/sources'),
    join(process.cwd(), 'backend/src/regulatory/sources'),
  ];
  return candidates.find((dir) => existsSync(dir)) || candidates[0];
}

export function dpdpActPath(): string {
  return join(sourceDir(), 'dpdp-act.txt');
}

export function dpdpNoticePath(): string {
  return join(sourceDir(), 'dpdp-commencement.txt');
}

export interface CommencementAssignment {
  effectiveDate: string | null;
  status: string;
  basis: string;
}

interface NoticeRules {
  publicationDate: string;
  reference: string;
  buckets: Array<{ id: 'a' | 'b' | 'c'; effectiveDate: string; raw: string }>;
}

export function parseCommencementNotice(text: string): NoticeRules {
  const english = text.slice(text.indexOf('MINISTRY OF ELECTRONICS'));
  const reference = /G\.S\.R\.\s*843\(E\)/.test(english) ? 'G.S.R. 843(E)' : '';
  const dateMatch = english.match(/the\s+13th\s+November,\s+2025/i);
  if (!reference || !dateMatch) {
    throw new Error('Commencement notification did not contain G.S.R. 843(E) and 13 November 2025.');
  }
  const paragraph = (id: 'a' | 'b' | 'c') => {
    const match = english.match(new RegExp(`\\(${id}\\)([\\s\\S]*?)(?=\\n\\s*\\([a-c]\\)|\\[F\\.\\s*No\\.)`, 'i'));
    if (!match) throw new Error(`Commencement paragraph (${id}) was not found.`);
    return collapseWhitespace(match[1]);
  };
  return {
    publicationDate: '2025-11-13',
    reference,
    buckets: [
      { id: 'a', effectiveDate: '2025-11-13', raw: paragraph('a') },
      { id: 'b', effectiveDate: '2026-11-13', raw: paragraph('b') },
      { id: 'c', effectiveDate: '2027-05-13', raw: paragraph('c') },
    ],
  };
}

function expandRange(raw: string): number[] {
  const match = raw.match(/(\d+)\s+to\s+(\d+)/i);
  if (!match) return [];
  const start = Number(match[1]);
  const end = Number(match[2]);
  const values: number[] = [];
  for (let n = start; n <= end; n++) values.push(n);
  return values;
}

function wholeSections(raw: string): Set<number> {
  const found = new Set<number>();
  for (const range of raw.matchAll(/sections?\s+(\d+)\s+to\s+(\d+)/gi)) {
    for (let n = Number(range[1]); n <= Number(range[2]); n++) found.add(n);
  }
  for (const single of raw.matchAll(/section\s+(\d+)(?!\s+to)(?!\s*\()/gi)) {
    const n = Number(single[1]);
    if (!raw.slice(Math.max(0, single.index! - 20), single.index).includes('sub-section')) {
      found.add(n);
    }
  }
  // "sections 35, 38, 39, ..." after a range mention
  const list = raw.match(/sections\s+((?:\d+\s*,\s*)+\d+)/i);
  if (list) {
    for (const part of list[1].split(',')) {
      const n = Number(part.trim());
      if (n) found.add(n);
    }
  }
  return found;
}

export function assignCommencement(
  rules: NoticeRules,
  section: number,
  subsection?: number,
  point?: string,
): CommencementAssignment {
  const basis = `${rules.reference}, published ${rules.publicationDate}`;
  const bucketA = rules.buckets.find((bucket) => bucket.id === 'a')!;
  const bucketB = rules.buckets.find((bucket) => bucket.id === 'b')!;
  const bucketC = rules.buckets.find((bucket) => bucket.id === 'c')!;

  if (section === 1 && subsection === 2) {
    return { effectiveDate: bucketA.effectiveDate, status: 'Appointed', basis: `${basis}, paragraph (a): sub-section (2) of section 1.` };
  }
  if (section === 1 && subsection === 1) {
    return { effectiveDate: null, status: 'Not appointed by this notification', basis: `${basis} does not mention sub-section (1) of section 1.` };
  }
  if (section === 6 && subsection === 9) {
    return { effectiveDate: bucketB.effectiveDate, status: 'Appointed', basis: `${basis}, paragraph (b): sub-section (9) of section 6. One year from publication.` };
  }
  if (section === 6 && subsection && ((subsection >= 1 && subsection <= 8) || subsection === 10)) {
    return { effectiveDate: bucketC.effectiveDate, status: 'Appointed', basis: `${basis}, paragraph (c): sub-sections (1) to (8) and (10) of section 6. Eighteen months from publication.` };
  }
  if (section === 27 && subsection === 1 && point === 'd') {
    return { effectiveDate: bucketB.effectiveDate, status: 'Appointed', basis: `${basis}, paragraph (b): clause (d) of sub-section (1) of section 27.` };
  }
  if (section === 27 && subsection !== undefined && !(subsection === 1 && point === 'd')) {
    return { effectiveDate: bucketC.effectiveDate, status: 'Appointed except clause (d) of sub-section (1)', basis: `${basis}, paragraph (c): section 27 except clause (d) of sub-section (1).` };
  }
  if (section === 44 && (subsection === 1 || subsection === 3)) {
    return { effectiveDate: bucketA.effectiveDate, status: 'Appointed', basis: `${basis}, paragraph (a): sub-sections (1) and (3) of section 44.` };
  }
  if (section === 44 && subsection === 2) {
    return { effectiveDate: bucketC.effectiveDate, status: 'Appointed', basis: `${basis}, paragraph (c): sub-section (2) of section 44.` };
  }

  const wholeA = wholeSections(bucketA.raw);
  const wholeC = new Set<number>([
    ...expandRange('3 to 5'),
    ...expandRange('7 to 10'),
    ...expandRange('11 to 17'),
    ...expandRange('28 to 34'),
    36,
    37,
  ]);
  if (wholeA.has(section) && section !== 1 && section !== 44) {
    return { effectiveDate: bucketA.effectiveDate, status: 'Appointed', basis: `${basis}, paragraph (a) names this section.` };
  }
  if (wholeC.has(section)) {
    return { effectiveDate: bucketC.effectiveDate, status: 'Appointed', basis: `${basis}, paragraph (c) names this section. Eighteen months from publication.` };
  }
  if (section === 1 || section === 6 || section === 27 || section === 44) {
    return { effectiveDate: null, status: 'Split by G.S.R. 843(E)', basis: `${basis}. Subsections are appointed on different dates. No single date is stored on the parent.` };
  }
  return { effectiveDate: null, status: 'Not appointed by this notification', basis: `${basis} does not name section ${section}.` };
}

function cleanAct(text: string): string {
  return text
    .replace(/\f/g, '\n')
    .replace(/^.*GAZETTE OF INDIA.*$/gim, '')
    .replace(/^.*SEC\.\s*1\].*$/gim, '')
    .replace(/^.*PART II.*$/gim, '');
}

export function parseDpdp(actText: string, noticeText: string): InstrumentCatalog {
  const rules = parseCommencementNotice(noticeText);
  const cleaned = cleanAct(actText);
  const scheduleAt = cleaned.search(/\n\s*THE SCHEDULE\b/);
  const body = scheduleAt >= 0 ? cleaned.slice(0, scheduleAt) : cleaned;
  const positions = new Map<number, number>();
  for (let n = 1; n <= 44; n++) {
    const re = new RegExp(`(?<!\\d)${n}\\.\\s+(?=\\(1\\)|In this Act|[A-Z])`, 'g');
    let match: RegExpExecArray | null;
    while ((match = re.exec(body))) {
      const before = body.slice(Math.max(0, match.index - 40), match.index).toLowerCase();
      if (before.includes('section')) continue;
      positions.set(n, match.index);
      break;
    }
  }

  const chapters: Array<{ roman: string; title: string; index: number }> = [];
  const chapterRe = /CHAPTER\s+([IVX]+)\s*\n\s*([A-Z][A-Z ,']+)/g;
  let chapterMatch: RegExpExecArray | null;
  while ((chapterMatch = chapterRe.exec(body))) {
    chapters.push({
      roman: chapterMatch[1],
      title: collapseWhitespace(chapterMatch[2]),
      index: chapterMatch.index,
    });
  }

  const clauses: CatalogClause[] = [];
  for (const chapter of chapters) {
    clauses.push({
      sourceKey: `${STANDARD_KEY}:cpt:${chapter.roman}`,
      officialIdentifier: `Chapter ${chapter.roman}`,
      title: chapter.title,
      clauseType: 'chapter',
      parentSourceKey: null,
      standardSourceKey: STANDARD_KEY,
      sourceLocation: `CHAPTER ${chapter.roman}`,
      text: chapter.title,
      sourceUrl: ACT_URL,
      edition: EDITION,
      publicationDate: '2023-08-11',
      effectiveDate: null,
      legalStatus: 'Enacted on assent. Commencement is not the assent date.',
      repealStatus: 'No repeal stated in the retrieved Act.',
      commencementStatus: 'Chapter heading only. See section records.',
      provenance: PROVENANCE,
    });
  }

  const sectionNumbers = [...positions.keys()].sort((a, b) => a - b);
  for (const n of sectionNumbers) {
    const start = positions.get(n)!;
    const next = sectionNumbers.find((other) => other > n);
    const end = next ? positions.get(next)! : body.length;
    const raw = collapseWhitespace(body.slice(start, end));
    const chapter = [...chapters].reverse().find((item) => item.index < start);
    const assignment = assignCommencement(rules, n);
    clauses.push(sectionClause(n, raw, chapter ? `${STANDARD_KEY}:cpt:${chapter.roman}` : null, assignment));
    for (const child of splitChildren(n, raw, rules)) clauses.push(child);
  }

  const schedule = scheduleAt >= 0 ? cleaned.slice(scheduleAt) : '';
  if (schedule) {
    clauses.push({
      sourceKey: `${STANDARD_KEY}:sch`,
      officialIdentifier: 'The Schedule',
      title: 'The Schedule',
      clauseType: 'schedule',
      parentSourceKey: null,
      standardSourceKey: STANDARD_KEY,
      sourceLocation: 'THE SCHEDULE',
      text: collapseWhitespace(schedule).slice(0, 20000),
      sourceUrl: ACT_URL,
      edition: EDITION,
      publicationDate: '2023-08-11',
      effectiveDate: null,
      legalStatus: 'Part of the enacted Act. Penalty rows are not imported as approved obligations.',
      repealStatus: 'No repeal stated in the retrieved Act.',
      commencementStatus: 'Not given a separate appointment in G.S.R. 843(E).',
      provenance: PROVENANCE,
    });
  }

  const requirements = buildRequirements(clauses);
  const standard = buildStandard(rules, actText);
  const sectionCount = clauses.filter((clause) => clause.clauseType === 'section').length;
  return {
    standard,
    clauses,
    requirements,
    coverage: {
      structuralUnits: clauses.length,
      articlesOrSections: sectionCount,
      requirements: requirements.length,
      unitsWithoutRequirements: sectionCount - new Set(
        requirements.map((item) => item.primaryClauseSourceKey.replace(/:ss:.*$/, '').replace(/:pt:.*$/, '')),
      ).size,
      notes: [
        'India Code PDF was not retrieved (timeout). The Act text is the MeitY gazette PDF.',
        'Assent date 11 August 2023 is not treated as the effective date. Section 1(2) requires notification.',
        `Commencement follows ${rules.reference} only. Section 1(1) is not appointed by that notification.`,
        'Candidate requirements are explicit "shall" sentences and remain drafts.',
        `Sections located: ${sectionCount}.`,
      ],
    },
  };
}

function sectionClause(
  n: number,
  text: string,
  parent: string | null,
  assignment: CommencementAssignment,
): CatalogClause {
  return {
    sourceKey: `${STANDARD_KEY}:s:${n}`,
    officialIdentifier: `Section ${n}`,
    title: `Section ${n}`,
    clauseType: 'section',
    parentSourceKey: parent,
    standardSourceKey: STANDARD_KEY,
    sourceLocation: `Section ${n}`,
    text,
    sourceUrl: ACT_URL,
    edition: EDITION,
    publicationDate: '2023-08-11',
    effectiveDate: assignment.effectiveDate,
    legalStatus: 'Enacted. Commencement is recorded separately.',
    repealStatus: 'No repeal stated in the retrieved Act.',
    commencementStatus: `${assignment.status}. ${assignment.basis}`,
    provenance: PROVENANCE,
  };
}

function splitChildren(section: number, text: string, rules: ReturnType<typeof parseCommencementNotice>): CatalogClause[] {
  if (![1, 6, 27, 44].includes(section)) return [];
  const wanted = section === 1 ? [1, 2] : section === 44 ? [1, 2, 3] : section === 6 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] : [1];
  const children: CatalogClause[] = [];
  for (const subsection of wanted) {
    const extracted = extractSubsection(text, subsection);
    const assignment = assignCommencement(rules, section, subsection);
    children.push({
      sourceKey: `${STANDARD_KEY}:s:${section}:ss:${subsection}`,
      officialIdentifier: `Section ${section}(${subsection})`,
      title: `Section ${section}(${subsection})`,
      clauseType: 'subsection',
      parentSourceKey: `${STANDARD_KEY}:s:${section}`,
      standardSourceKey: STANDARD_KEY,
      sourceLocation: `Section ${section}(${subsection})`,
      text: extracted || `Subsection text was not split cleanly from the layout extract. Read Section ${section} in the parent record.`,
      sourceUrl: ACT_URL,
      edition: EDITION,
      publicationDate: '2023-08-11',
      effectiveDate: assignment.effectiveDate,
      legalStatus: 'Enacted. Commencement is recorded separately.',
      repealStatus: 'No repeal stated in the retrieved Act.',
      commencementStatus: `${assignment.status}. ${assignment.basis}`,
      provenance: extracted
        ? PROVENANCE
        : `${PROVENANCE} Subsection split was not reliable, so the parent section holds the wording.`,
    });
  }
  if (section === 27) {
    const assignment = assignCommencement(rules, 27, 1, 'd');
    children.push({
      sourceKey: `${STANDARD_KEY}:s:27:ss:1:pt:d`,
      officialIdentifier: 'Section 27(1)(d)',
      title: 'Section 27(1)(d)',
      clauseType: 'subsection',
      parentSourceKey: `${STANDARD_KEY}:s:27:ss:1`,
      standardSourceKey: STANDARD_KEY,
      sourceLocation: 'Section 27(1)(d)',
      text: 'Clause (d) of sub-section (1) of section 27 is appointed separately by paragraph (b) of G.S.R. 843(E). The clause wording remains in the parent section record.',
      sourceUrl: ACT_URL,
      edition: EDITION,
      publicationDate: '2023-08-11',
      effectiveDate: assignment.effectiveDate,
      legalStatus: 'Enacted. Commencement is recorded separately.',
      repealStatus: 'No repeal stated in the retrieved Act.',
      commencementStatus: `${assignment.status}. ${assignment.basis}`,
      provenance: `${PROVENANCE} The point text was not extracted as a standalone quote.`,
    });
  }
  return children;
}

function extractSubsection(text: string, subsection: number): string {
  const re = new RegExp(`\\(${subsection}\\)\\s+([\\s\\S]*?)(?=\\(${subsection + 1}\\)\\s+|$)`);
  const match = text.match(re);
  if (!match) return '';
  const value = collapseWhitespace(match[1]);
  if (value.length < 20) return '';
  return `(${subsection}) ${value}`.slice(0, 8000);
}

function buildRequirements(clauses: CatalogClause[]): CatalogRequirement[] {
  const requirements: CatalogRequirement[] = [];
  for (const clause of clauses) {
    if (clause.clauseType !== 'section') continue;
    const sentences = explicitShallSentences(clause.text);
    sentences.forEach((sentence, index) => {
      requirements.push({
        sourceKey: `${clause.sourceKey}:shall:${index + 1}`,
        title: `${clause.officialIdentifier} candidate ${index + 1}`,
        statement: sentence,
        rationale: 'The retrieved section text contains the word "shall". This is a draft candidate, not a verified obligation.',
        requirementType: 'Candidate explicit shall',
        classification: 'Explicit shall in retrieved source text. Not a verified legal conclusion.',
        primaryClauseSourceKey: clause.sourceKey,
        additionalClauseSourceKeys: [],
        standardSourceKey: STANDARD_KEY,
        sourceUrl: ACT_URL,
        pinpoint: clause.officialIdentifier,
        edition: EDITION,
        jurisdiction: 'India',
        effectiveDate: clause.effectiveDate,
        legalStatus: clause.commencementStatus,
        suggestedProcedure: 'A reviewer should confirm commencement and exceptions before treating this sentence as an assessable obligation.',
        suggestedEvidence: 'Suggested only: a record that the quoted duty was considered. This is not evidence of compliance.',
      });
    });
  }
  return requirements;
}

function buildStandard(rules: NoticeRules, actText: string): CatalogStandard {
  const assent = /11th August, 2023/.test(actText);
  return {
    sourceKey: STANDARD_KEY,
    standardId: 'India Act 22 of 2023',
    name: 'The Digital Personal Data Protection Act, 2023',
    standardType: 'Act',
    issuingAuthority: 'Parliament of India; published by the Ministry of Law and Justice (Legislative Department). PDF hosted by MeitY.',
    jurisdiction: 'India',
    industry: 'Cross-sector',
    publicationReference: 'Gazette of India, Extraordinary, Part II, Section 1, No. 25, CG-DL-E-12082023-248045',
    sourceUrl: ACT_URL,
    citationUrl: CITATION_URL,
    language: 'EN',
    edition: EDITION,
    adoptionDate: assent ? '2023-08-11' : null,
    publicationDate: assent ? '2023-08-11' : null,
    effectiveDate: null,
    repealDate: null,
    legalStatus: 'Received the assent of the President on 11 August 2023, as stated in the retrieved gazette PDF. The Act is not treated as fully commenced on that date.',
    commencementStatus: 'Partial. G.S.R. 843(E) appoints different provisions on 13 November 2025, 13 November 2026, and 13 May 2027. Section 1(1) is not appointed by that notification.',
    checksum: 'sha256:4deb23981d3010c8225a2ff6149e7243dc2268455b299e283afebdd7b72a7d15',
    licensingNotes: 'Official gazette text hosted by MeitY. The India Code bitstream named in the request timed out. Store the MeitY URL with the record.',
    retrievalDate: '2026-10-28',
    commencementNotificationUrl: NOTICE_URL,
    commencementNotificationReference: rules.reference,
    commencementNotificationDate: rules.publicationDate,
  };
}

export function loadDpdpCatalog(): InstrumentCatalog {
  return parseDpdp(readFileSync(dpdpActPath(), 'utf8'), readFileSync(dpdpNoticePath(), 'utf8'));
}

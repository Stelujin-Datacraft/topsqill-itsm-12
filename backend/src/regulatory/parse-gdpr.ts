import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { CatalogClause, CatalogRequirement, CatalogStandard, InstrumentCatalog } from './types';
import { explicitShallSentences, stripHtml } from './text-utils';

const CELEX = '32016R0679';
const STANDARD_KEY = `celex:${CELEX}`;
const SOURCE_URL =
  'http://publications.europa.eu/resource/cellar/3e485e15-11bd-11e6-ba9a-01aa75ed71a1.0006.03/DOC_1';
const CITATION_URL = 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679';
const EDITION = 'OJ L 119, 4.5.2016, p. 1; CELEX 32016R0679; Publications Office manifestation retrieved 2026-10-28';
const PROVENANCE =
  'Official Journal text retrieved from the Publications Office of the European Union (CELEX 32016R0679). Source text is kept separate from any later AI summary.';

export function gdprSourcePath(): string {
  return join(sourceDir(), 'gdpr.xhtml');
}

function sourceDir(): string {
  const candidates = [
    join(__dirname, 'sources'),
    join(process.cwd(), 'src/regulatory/sources'),
    join(process.cwd(), 'backend/src/regulatory/sources'),
  ];
  return candidates.find((dir) => existsSync(dir)) || candidates[0];
}

interface Marker {
  kind: 'chapter' | 'section' | 'article' | 'recital' | 'paragraph';
  index: number;
  id: string;
  articleNumber?: number;
  paragraphNumber?: number;
  recitalNumber?: number;
}

function roman(id: string): string {
  return id.replace(/^cpt_/, '').replace(/\.sct_.*$/, '');
}

function sectionNumber(id: string): string {
  const match = id.match(/sct_(\d+)/);
  return match ? match[1] : id;
}

export function parseGdprHtml(html: string): InstrumentCatalog {
  const markers: Marker[] = [];
  const push = (re: RegExp, build: (m: RegExpExecArray) => Marker | null) => {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(html))) {
      const marker = build(match);
      if (marker) markers.push(marker);
    }
  };

  push(/<div id="(cpt_[A-Z]+)">/g, (m) => ({ kind: 'chapter', index: m.index, id: m[1] }));
  push(/<div id="(cpt_[A-Z]+\.sct_\d+)">/g, (m) => ({ kind: 'section', index: m.index, id: m[1] }));
  push(/<div class="eli-subdivision" id="(art_(\d+))">/g, (m) => ({
    kind: 'article',
    index: m.index,
    id: m[1],
    articleNumber: Number(m[2]),
  }));
  push(/<div class="eli-subdivision" id="(rct_(\d+))">/g, (m) => ({
    kind: 'recital',
    index: m.index,
    id: m[1],
    recitalNumber: Number(m[2]),
  }));
  push(/<div id="(\d{3})\.(\d{3})">/g, (m) => ({
    kind: 'paragraph',
    index: m.index,
    id: `${m[1]}.${m[2]}`,
    articleNumber: Number(m[1]),
    paragraphNumber: Number(m[2]),
  }));

  markers.sort((a, b) => a.index - b.index || a.kind.localeCompare(b.kind));

  const publicationDate = /<p class="oj-hd-date">\s*(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(html);
  const published = publicationDate
    ? `${publicationDate[3]}-${publicationDate[2].padStart(2, '0')}-${publicationDate[1].padStart(2, '0')}`
    : null;

  const clauses: CatalogClause[] = [];
  let chapterKey: string | null = null;
  let sectionKey: string | null = null;
  let articleKey: string | null = null;

  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const slice = html.slice(marker.index, markers[i + 1]?.index ?? html.length);
    const title = extractTitle(marker.kind, slice);
    const text = stripHtml(slice).slice(0, 20000);

    if (marker.kind === 'chapter') {
      chapterKey = `${STANDARD_KEY}:cpt:${roman(marker.id)}`;
      sectionKey = null;
      articleKey = null;
      clauses.push(baseClause({
        sourceKey: chapterKey,
        officialIdentifier: `Chapter ${roman(marker.id)}`,
        title: title || `Chapter ${roman(marker.id)}`,
        clauseType: 'chapter',
        parentSourceKey: null,
        sourceLocation: marker.id,
        text: title || `Chapter ${roman(marker.id)}`,
        effectiveDate: null,
      }));
      continue;
    }

    if (marker.kind === 'section') {
      sectionKey = `${STANDARD_KEY}:cpt:${roman(marker.id)}:sct:${sectionNumber(marker.id)}`;
      clauses.push(baseClause({
        sourceKey: sectionKey,
        officialIdentifier: `Chapter ${roman(marker.id)}, Section ${sectionNumber(marker.id)}`,
        title: title || `Section ${sectionNumber(marker.id)}`,
        clauseType: 'section',
        parentSourceKey: chapterKey,
        sourceLocation: marker.id,
        text: title || `Section ${sectionNumber(marker.id)}`,
        effectiveDate: null,
      }));
      continue;
    }

    if (marker.kind === 'article' && marker.articleNumber) {
      articleKey = `${STANDARD_KEY}:art:${marker.articleNumber}`;
      const hasParagraph = markers.some(
        (other) => other.kind === 'paragraph' && other.articleNumber === marker.articleNumber,
      );
      clauses.push(baseClause({
        sourceKey: articleKey,
        officialIdentifier: `Article ${marker.articleNumber}`,
        title: title || `Article ${marker.articleNumber}`,
        clauseType: 'article',
        parentSourceKey: sectionKey || chapterKey,
        sourceLocation: marker.id,
        text: hasParagraph
          ? `${title || `Article ${marker.articleNumber}`}. Numbered paragraph text is stored on the child paragraph records.`
          : text,
        effectiveDate: marker.articleNumber === 99 ? '2018-05-25' : null,
      }));
      continue;
    }

    if (marker.kind === 'paragraph' && marker.articleNumber && marker.paragraphNumber) {
      clauses.push(baseClause({
        sourceKey: `${STANDARD_KEY}:art:${marker.articleNumber}:p:${marker.paragraphNumber}`,
        officialIdentifier: `Article ${marker.articleNumber}(${marker.paragraphNumber})`,
        title: `Article ${marker.articleNumber}(${marker.paragraphNumber})`,
        clauseType: 'paragraph',
        parentSourceKey: `${STANDARD_KEY}:art:${marker.articleNumber}`,
        sourceLocation: marker.id,
        text,
        effectiveDate: null,
      }));
      continue;
    }

    if (marker.kind === 'recital' && marker.recitalNumber) {
      clauses.push(baseClause({
        sourceKey: `${STANDARD_KEY}:rct:${marker.recitalNumber}`,
        officialIdentifier: `Recital ${marker.recitalNumber}`,
        title: `Recital (${marker.recitalNumber})`,
        clauseType: 'recital',
        parentSourceKey: null,
        sourceLocation: marker.id,
        text,
        effectiveDate: null,
      }));
    }
  }

  const article99 = clauses.find((clause) => clause.sourceKey === `${STANDARD_KEY}:art:99:p:2`);
  const applicationDate = article99 && /25 May 2018/.test(article99.text) ? '2018-05-25' : null;
  if (!applicationDate) {
    for (const clause of clauses) {
      if (clause.sourceKey.startsWith(`${STANDARD_KEY}:art:99`)) clause.effectiveDate = null;
    }
  }

  const requirements = buildRequirements(clauses, applicationDate);
  const articleCount = clauses.filter((clause) => clause.clauseType === 'article').length;
  const withRequirements = new Set(requirements.map((item) => item.primaryClauseSourceKey));
  const substantive = clauses.filter((clause) => clause.clauseType === 'article' || clause.clauseType === 'paragraph');

  const standard: CatalogStandard = {
    sourceKey: STANDARD_KEY,
    standardId: 'CELEX:32016R0679',
    name: 'Regulation (EU) 2016/679 of the European Parliament and of the Council',
    standardType: 'Regulation',
    issuingAuthority: 'European Parliament and Council of the European Union',
    jurisdiction: 'European Union',
    industry: 'Cross-sector',
    publicationReference: 'Official Journal of the European Union, L 119, 4.5.2016, p. 1',
    sourceUrl: SOURCE_URL,
    citationUrl: CITATION_URL,
    language: 'EN',
    edition: EDITION,
    adoptionDate: null,
    publicationDate: published,
    effectiveDate: applicationDate,
    repealDate: null,
    legalStatus: applicationDate
      ? 'Published in the Official Journal. Article 99(2) of the retrieved text states that it shall apply from 25 May 2018.'
      : 'Published in the Official Journal. Application date was not found in Article 99 of this snapshot.',
    commencementStatus: applicationDate
      ? 'Article 99(2) states application from 25 May 2018. Article 99(1) states entry into force on the twentieth day following publication; that calendar date is not computed here.'
      : 'Application date not extracted.',
    checksum: 'sha256:962539af03738bf552319ff4ce42d69e5f95a576307c4dfed7bf87e81b646b9d',
    licensingNotes:
      'Text retrieved from the Publications Office manifestation of CELEX 32016R0679. Cite the Official Journal and CELEX identifier. This catalog stores the retrieved wording separately from AI summaries.',
    retrievalDate: '2026-10-28',
    commencementNotificationUrl: '',
    commencementNotificationReference: '',
    commencementNotificationDate: null,
  };

  return {
    standard,
    clauses,
    requirements,
    coverage: {
      structuralUnits: clauses.length,
      articlesOrSections: articleCount,
      requirements: requirements.length,
      unitsWithoutRequirements: substantive.filter((clause) => !withRequirements.has(clause.sourceKey) && clause.clauseType === 'article').length,
      notes: [
        'EUR-Lex HTML returned an empty WAF challenge. This snapshot is the Publications Office XHTML for the same CELEX.',
        'Recitals are indexed and are not treated as independent obligations.',
        'Requirements are draft sentences containing an explicit "shall", excluding definitional formulae. They are not verified legal obligations.',
        `Articles parsed: ${articleCount}. Expected from this snapshot: 99.`,
      ],
    },
  };
}

function extractTitle(kind: Marker['kind'], slice: string): string {
  if (kind === 'article') {
    const match = slice.match(/<p class="oj-sti-art">([\s\S]*?)<\/p>/);
    return match ? stripHtml(match[1]) : '';
  }
  if (kind === 'chapter' || kind === 'section') {
    const match = slice.match(/<p[^>]*class="oj-ti-section-2"[^>]*>([\s\S]*?)<\/p>/);
    return match ? stripHtml(match[1]) : '';
  }
  return '';
}

function baseClause(input: Omit<CatalogClause, 'standardSourceKey' | 'sourceUrl' | 'edition' | 'publicationDate' | 'legalStatus' | 'repealStatus' | 'commencementStatus' | 'provenance'> & { effectiveDate: string | null }): CatalogClause {
  return {
    ...input,
    standardSourceKey: STANDARD_KEY,
    sourceUrl: SOURCE_URL,
    edition: EDITION,
    publicationDate: '2016-05-04',
    legalStatus: 'See the Standard record. Individual paragraph repeal is not asserted.',
    repealStatus: 'No repeal stated in this snapshot.',
    commencementStatus: input.effectiveDate
      ? 'Article 99(2) of the retrieved text states application from 25 May 2018.'
      : 'No provision-specific application date extracted. See Article 99.',
    provenance: PROVENANCE,
  };
}

function buildRequirements(clauses: CatalogClause[], applicationDate: string | null): CatalogRequirement[] {
  const paragraphsByArticle = new Set(
    clauses.filter((clause) => clause.clauseType === 'paragraph').map((clause) => clause.parentSourceKey),
  );
  const requirements: CatalogRequirement[] = [];
  for (const clause of clauses) {
    if (clause.clauseType === 'recital' || clause.clauseType === 'chapter' || clause.clauseType === 'section') continue;
    if (clause.clauseType === 'article' && paragraphsByArticle.has(clause.sourceKey)) continue;
    const sentences = explicitShallSentences(clause.text);
    sentences.forEach((sentence, index) => {
      requirements.push({
        sourceKey: `${clause.sourceKey}:shall:${index + 1}`,
        title: `${clause.officialIdentifier} candidate ${index + 1}`,
        statement: sentence,
        rationale: 'The retrieved source text of this provision contains the word "shall". This is a draft candidate, not a verified obligation.',
        requirementType: 'Candidate explicit shall',
        classification: 'Explicit shall in retrieved source text. Not a verified legal conclusion.',
        primaryClauseSourceKey: clause.sourceKey,
        additionalClauseSourceKeys: [],
        standardSourceKey: STANDARD_KEY,
        sourceUrl: SOURCE_URL,
        pinpoint: clause.officialIdentifier,
        edition: EDITION,
        jurisdiction: 'European Union',
        effectiveDate: applicationDate,
        legalStatus: 'Source provision indexed. Candidate is unverified.',
        suggestedProcedure: 'A reviewer should read the cited provision, including exceptions in the same article, before approving an assessment procedure.',
        suggestedEvidence: 'Suggested only: a record of the process described by the quoted sentence. This is not evidence of compliance.',
      });
    });
  }
  return requirements;
}

export function loadGdprCatalog(): InstrumentCatalog {
  return parseGdprHtml(readFileSync(gdprSourcePath(), 'utf8'));
}

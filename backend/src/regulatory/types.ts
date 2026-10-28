export type ClauseKind =
  | 'chapter'
  | 'section'
  | 'article'
  | 'paragraph'
  | 'recital'
  | 'schedule'
  | 'subsection';

export interface CatalogClause {
  sourceKey: string;
  officialIdentifier: string;
  title: string;
  clauseType: ClauseKind;
  parentSourceKey: string | null;
  standardSourceKey: string;
  sourceLocation: string;
  text: string;
  sourceUrl: string;
  edition: string;
  publicationDate: string | null;
  effectiveDate: string | null;
  legalStatus: string;
  repealStatus: string;
  commencementStatus: string;
  provenance: string;
}

export interface CatalogRequirement {
  sourceKey: string;
  title: string;
  statement: string;
  rationale: string;
  requirementType: string;
  classification: string;
  primaryClauseSourceKey: string;
  additionalClauseSourceKeys: string[];
  standardSourceKey: string;
  sourceUrl: string;
  pinpoint: string;
  edition: string;
  jurisdiction: string;
  effectiveDate: string | null;
  legalStatus: string;
  suggestedProcedure: string;
  suggestedEvidence: string;
}

export interface CatalogStandard {
  sourceKey: string;
  standardId: string;
  name: string;
  standardType: string;
  issuingAuthority: string;
  jurisdiction: string;
  industry: string;
  publicationReference: string;
  sourceUrl: string;
  citationUrl: string;
  language: string;
  edition: string;
  adoptionDate: string | null;
  publicationDate: string | null;
  effectiveDate: string | null;
  repealDate: string | null;
  legalStatus: string;
  commencementStatus: string;
  checksum: string;
  licensingNotes: string;
  retrievalDate: string;
  commencementNotificationUrl: string;
  commencementNotificationReference: string;
  commencementNotificationDate: string | null;
}

export interface InstrumentCatalog {
  standard: CatalogStandard;
  clauses: CatalogClause[];
  requirements: CatalogRequirement[];
  coverage: {
    structuralUnits: number;
    articlesOrSections: number;
    requirements: number;
    unitsWithoutRequirements: number;
    notes: string[];
  };
}

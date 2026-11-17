export type Relation = 'strong' | 'concurrent';
export type Requirement =
  | { type: 'course'; courseId: string; relation: Relation }
  | { type: 'and' | 'or'; items: Requirement[] };
export interface Course {
  id: string;
  name: string;
  faculty: string;
  faculties?: string[];
  credits?: number;
  aliases?: string[];
  availableSourceTerms?: string[];
  catalogOnly?: boolean;
  requirements: Requirement | null;
  requirementsStatus: 'known' | 'none' | 'unknown' | 'unparsed';
  rawRequirements?: string;
  source: { url: string; term?: string; label?: string };
}
export interface CourseDataset {
  meta: Record<string, unknown>;
  courses: Course[];
}

export interface CatalogSource {
  id: string;
  url: string;
  catalogYear: string;
  facultyId: string;
  sha256: string;
  pageCount: number;
  courseNumberColumn?: [number, number, number, number];
  printedPageOffset?: number;
}
export interface CatalogReference { sourceId: string; pages: number[]; printedPages?: number[]; section?: string }
export interface CatalogRule {
  id: string;
  kind: 'faculty' | 'all-courses' | 'approval' | 'course-prefix';
  coursePrefixes?: string[];
  facultyIds?: string[];
  excludeCourseIds?: string[];
  description: string;
  sourceUrls?: string[];
  automatic: boolean;
}
export interface CatalogGroup {
  id: string;
  name: string;
  role: 'mandatory' | 'mandatory-choice' | 'elective' | 'specialization' | 'additional';
  courseIds: string[];
  offeringFacultyId?: string;
  creditsMin?: number;
  minimumCourses?: number;
  maximumCredits?: number;
  requiredCourseIds?: string[];
  conditions: string[];
  rules: CatalogRule[];
  sourceRefs: CatalogReference[];
}
export type ProgramCategory = 'standard' | 'combined' | 'dual-major' | 'double-degree' | 'concentration' | 'additional-degree' | 'teaching-qualification';
export type CurriculumRequirement = {
  id?: string;
  label?: string;
  sourceRefs?: CatalogReference[];
} & (
  | { type: 'course'; courseId: string }
  | { type: 'all'; items: CurriculumRequirement[] }
  | { type: 'any'; items: CurriculumRequirement[] }
  | { type: 'choose'; items: CurriculumRequirement[]; minimumCourses?: number; minimumCredits?: number; maximumCredits?: number }
  | { type: 'group'; groupId: string }
  | { type: 'condition'; text: string; requirement?: CurriculumRequirement }
  | { type: 'substitution'; originalCourseIds: string[]; replacementCourseIds: string[]; description?: string }
);
export interface DegreeCatalog {
  id: string;
  programId: string;
  facultyIds: string[];
  officialName: string;
  degreeType: string;
  programCategory?: ProgramCategory;
  parentProgramId?: string;
  qualificationAwarded?: string[];
  requirementRules?: CurriculumRequirement[];
  durationYears?: number;
  track?: string;
  catalogYear: string;
  mandatoryCourseIds: string[];
  electiveGroups: CatalogGroup[];
  additionalEligibleCourseIds: string[];
  sourceRefs: CatalogReference[];
  coverage: { status: 'verified-listed' | 'partial' | 'inventory-only'; notes: string[]; mandatoryComplete?: boolean; electivesComplete?: boolean; visuallyVerified?: boolean };
}
export interface CatalogDataset {
  meta: { generatedAt: string; programCount: number; editionCount: number; years: string[]; catalogFacultyCount?: number; collectedDocumentCount?: number; importedDocumentCount?: number; missingCourseRecordCount?: number; defaultYear?: string; coverageStats?: Record<string, number>; notes: string[] };
  sources: CatalogSource[];
  programs: DegreeCatalog[];
  referencedCourses?: Course[];
}

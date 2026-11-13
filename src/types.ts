export type Relation = 'strong' | 'concurrent';
export type Requirement =
  | { type: 'course'; courseId: string; relation: Relation }
  | { type: 'and' | 'or'; items: Requirement[] };
export interface Course {
  id: string;
  name: string;
  faculty: string;
  credits?: number;
  aliases?: string[];
  requirements: Requirement | null;
  requirementsStatus: 'known' | 'none' | 'unknown' | 'unparsed';
  rawRequirements?: string;
  source: { url: string; term?: string; label?: string };
}
export interface CourseDataset {
  meta: Record<string, unknown>;
  courses: Course[];
}

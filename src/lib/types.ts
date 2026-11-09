export type Req =
  | { type: "course"; code: string }
  | { type: "and" | "or"; children: Req[] };

export interface AssessmentItem {
  type: string;
  weight: number;
}

export interface IndexEntry {
  code: string;
  title: string;
  department: string | null;
  prefix: string;
  units: number | null;
  terms: string[];
  courseLevel: number | null;
  fheqLevel: number | null;
  convenors: string[];
  assessment: AssessmentItem[];
  snippet: string | null;
}

export interface Preclusion {
  code: string;
  title: string;
  note: string | null;
}

export interface Course {
  code: string;
  title: string;
  status: string;
  session: string;
  department: string | null;
  units: number | null;
  studyPeriod: string | null;
  terms: string[];
  fheqLevel: number | null;
  courseLevel: number | null;
  convenors: string[];
  prerequisites: string | null;
  corequisites: string | null;
  additionalRequisites: string | null;
  availability: string | null;
  description: string | null;
  teaching: string | null;
  formativeAssessment: string | null;
  indicativeReading: string[];
  assessmentText: string | null;
  assessment: AssessmentItem[];
  skills: string[];
  stats: {
    totalStudentsPrevYear: number | null;
    avgClassSizePrevYear: number | null;
    capped: string | null;
  };
  sourceUrl: string;
  lastScraped: string;
  prereqTree: Req | null;
  coreqTree: Req | null;
  prereqCheck: boolean;
  preclusions: Preclusion[];
  unlocks: string[];
}

export interface Meta {
  session: string;
  generated: string;
  courseCount: number;
}

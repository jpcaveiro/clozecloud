export type FieldKind = 'numerical' | 'multichoice' | 'shortanswer';
export type FieldLayout = 'dropdown' | 'vertical' | 'horizontal';

export interface ClozeOption {
  /** Option text (for numerical: the expected value as written, without tolerance). */
  text: string;
  /** Percentage of the field weight, 0..100 (may be negative). */
  fraction: number;
  feedback: string;
  /** Numerical only. */
  value?: number;
  tolerance?: number;
}

export interface ClozeField {
  /** 1-based position of the field within the question text. */
  index: number;
  kind: FieldKind;
  layout: FieldLayout;
  caseSensitive: boolean;
  shuffle: boolean;
  weight: number;
  options: ClozeOption[];
}

export type ClozePart =
  | { kind: 'text'; html: string }
  | { kind: 'field'; field: ClozeField };

export interface ParsedCloze {
  parts: ClozePart[];
  fields: ClozeField[];
}

export interface Question {
  type: string;
  name: string;
  /** Raw question text as stored in the XML. */
  text: string;
  generalFeedback: string;
  defaultGrade: number;
  parts: ClozePart[];
  fields: ClozeField[];
}

export interface Quiz {
  category?: string;
  questions: Question[];
}

export interface FieldResult {
  index: number;
  answered: boolean;
  fraction: number;
  correct: boolean;
  feedback: string;
  /** Text of the best option, to show a solution. */
  expected: string;
}

export interface GradeResult {
  /** Weighted score in [0, 1]. */
  score: number;
  correct: boolean;
  fields: FieldResult[];
}

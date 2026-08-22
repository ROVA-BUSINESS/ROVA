export type QuestionType =
  | 'number'
  | 'single_select'
  | 'multi_select_searchable'
  | 'number_repeat_per_selection'
  | 'chip_select_then_amount'
  | 'chip_select_then_amount_nested'
  | 'boolean'
  | 'boolean_then_amount'
  | 'confirm_action';

export interface QuestionOptionalBreakdown {
  toggle_label: string;
  fields: string[];
  nrs_fields: string[];
}

export interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  nrs_field?: string;
  required?: boolean;
  default?: any;
  options?: string[];
  min_select?: number;
  repeat_source?: string;
  prompt_template?: string;
  nrs_field_template?: string;
  base_options?: string[];
  conditional_options?: Record<string, string[]>;
  nrs_field_map?: Record<string, string>;
  nrs_field_map_top?: Record<string, string>;
  nrs_field_map_group?: string;
  flags_set?: Record<string, string>;
  show_if?: string;
  ui?: string;
  groups?: Record<string, string[]>;
  top_level?: string[];
  nested_on?: Record<string, string[]>;
  optional_breakdown?: QuestionOptionalBreakdown;
  note?: string;
  effects?: Record<string, string>;
}

export interface DerivedField {
  id: string;
  formula: string;
  nrs_field?: string;
  show_if?: string;
  ui?: 'confirm_card' | string;
  note?: string;
}

export interface CalculatedField {
  id: string;
  formula: string;
  nrs_field?: string;
  ui?: 'live_inline_warning_if_false' | string;
}

export interface Stage {
  id: string;
  title: string;
  always_show?: boolean;
  show_if?: string;
  questions?: Question[];
  derived?: DerivedField[];
  calculated?: CalculatedField[];
  ui?: string;
}

export interface NrsFlowMeta {
  name: string;
  version: string;
  principle: string;
  answer_store: string;
}

export interface NrsFlowConfig {
  meta: NrsFlowMeta;
  stages: Stage[];
}

export type AnswerStore = Record<string, any>;

export interface NrsFilingDraft {
  filing_id?: string;
  user_id: string;
  year_of_assessment: number;
  current_stage_id: string;
  answers: AnswerStore;
  status: 'draft' | 'submitted';
  updated_at: string;
}

export type NrsExportPayload = Record<string, string | number>;

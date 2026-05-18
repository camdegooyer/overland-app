/**
 * Manual TypeScript types for the roster data model.
 * Until we generate types from Supabase, these are the contracts the app code uses.
 */

export type RosterEmployee = {
  id: string;
  contact_id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  display_first_name: string | null;
  trade: string | null;
  is_roster_employee: boolean;
  roster_sort_order: number;
  notify_enabled: boolean;
  is_active: boolean;
  email: string | null;
  team_role: "admin" | "staff";
};

export type RosterProject = {
  project_id: string;
  job_code: string | null;
  suburb: string | null;
  street_address: string | null;
  stage: string | null;
  display_name: string | null;
  derived_label: string | null;
  show_in_side_panel: boolean;
  colour: string;
  default_start_time: string | null;
  default_finish_time: string | null;
  sort_order: number;
  roster_notes: string | null;
};

export type RosterOtherItem = {
  id: string;
  label: string;
  colour: string;
  sort_order: number;
  is_active: boolean;
};

export type RosterDayDefault = {
  day_of_week: number; // 1=Mon .. 7=Sun (ISO)
  start_time: string;
  finish_time: string;
};

export type RosterSettings = {
  id: 1;
  default_start_time: string;
  default_finish_time: string;
  default_break_minutes: number;
  default_split_start_time: string;
  week_starts_on: number;
  show_weekends: boolean;
  updated_at: string;
};

export type RosterAuditEntityType =
  | "employee_day_card"
  | "roster_assignment"
  | "project_roster_meta"
  | "employee_roster_meta"
  | "roster_settings"
  | "roster_display_token";

export type RosterAuditAction = "create" | "update" | "delete" | "move";

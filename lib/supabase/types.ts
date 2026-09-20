export type Gender = "male" | "female";

export type SurveyCategory = "appearance" | "personality";

export type SurveyQuestionRow = {
  id: string;
  key: string;
  category: SurveyCategory;
  self_label: string;
  ideal_label: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
};

export type SurveyOptionRow = {
  id: string;
  question_id: string;
  label: string;
  gender_scope: "all" | "male" | "female";
  display_order: number;
  created_at: string;
};

type ReadonlyTable<Row> = {
  Row: Row;
  Insert: Record<string, never>;
  Update: Record<string, never>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      survey_questions: ReadonlyTable<SurveyQuestionRow>;
      survey_options: ReadonlyTable<SurveyOptionRow>;
    };
    Views: Record<string, never>;
    Functions: {
      create_participant_application: {
        Args: {
          p_gender: Gender;
          p_name: string;
          p_age: number;
          p_major: string;
          p_phone: string;
          p_max_match_count: number;
          p_self_option_ids: string[];
          p_ideal_option_ids: string[];
          p_must_match_question_ids: string[];
        };
        Returns: string;
      };
    };
  };
};

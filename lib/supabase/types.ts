export type Gender = "male" | "female";

export type OptionRow = {
  id: string;
  label: string;
  gender_scope: "all" | "male" | "female";
  display_order: number;
  is_active: boolean;
  created_at: string;
};

type OptionTable = {
  Row: OptionRow;
  Insert: Record<string, never>;
  Update: Record<string, never>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      appeal_point_options: OptionTable;
      ideal_type_options: OptionTable;
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
          p_appeal_point_ids: string[];
          p_ideal_type_ids: string[];
        };
        Returns: string;
      };
    };
  };
};

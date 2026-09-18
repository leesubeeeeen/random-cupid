import type { ApplicationFormFieldErrors } from "@/lib/validation";

export interface ApplicationFormState {
  status: "idle" | "error" | "success";
  fieldErrors?: ApplicationFormFieldErrors;
  formError?: string;
}

export const initialApplicationFormState: ApplicationFormState = {
  status: "idle",
};

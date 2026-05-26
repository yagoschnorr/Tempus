import { api } from "@/lib/api/client";
import type {
  CreateStudyPlanInput,
  StudyPlan,
  StudyPlanStatus,
  UpdateStudyPlanInput,
  UUID,
} from "@/lib/api/types";

export const studyPlansApi = {
  list() {
    return api<StudyPlan[]>("/study-plans");
  },

  get(id: UUID) {
    return api<StudyPlan>(`/study-plans/${id}`);
  },

  generate(input: CreateStudyPlanInput) {
    return api<StudyPlan>("/study-plans/generate", {
      method: "POST",
      json: input,
    });
  },

  updateStatus(id: UUID, status: StudyPlanStatus) {
    const body: UpdateStudyPlanInput = { status };
    return api<StudyPlan>(`/study-plans/${id}`, {
      method: "PATCH",
      json: body,
    });
  },
};

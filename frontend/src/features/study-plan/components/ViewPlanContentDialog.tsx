import Markdown from "react-markdown";
import { Modal } from "@/components/Modal";
import type { StudyPlan } from "@/lib/api/types";
import { markdownComponents } from "../markdown";

interface Props {
  plan: StudyPlan | null;
  onClose: () => void;
}

export function ViewPlanContentDialog({ plan, onClose }: Props) {
  return (
    <Modal open={Boolean(plan)} onClose={onClose} title={plan?.title ?? ""}>
      <div className="text-sm max-h-[60vh] overflow-y-auto">
        {plan && (
          <Markdown components={markdownComponents}>{plan.plan_content}</Markdown>
        )}
      </div>
    </Modal>
  );
}

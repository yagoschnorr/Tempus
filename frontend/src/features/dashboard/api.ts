import { api } from "@/lib/api/client";
import type { RealtimeDashboard } from "@/lib/api/types";

export const dashboardApi = {
  realtime() {
    return api<RealtimeDashboard>("/dashboard/realtime");
  },
};

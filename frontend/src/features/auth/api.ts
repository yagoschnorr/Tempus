import { api } from "@/lib/api/client";
import type { AuthResponse, User } from "@/lib/api/types";

export const authApi = {
  login(email: string, password: string) {
    return api<AuthResponse>("/auth/login", {
      method: "POST",
      json: { email, password },
    });
  },

  register(name: string, email: string, password: string) {
    return api<AuthResponse>("/auth/register", {
      method: "POST",
      json: { name, email, password },
    });
  },

  me() {
    return api<User>("/auth/me");
  },
};

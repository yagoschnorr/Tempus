import { api } from "@/lib/api/client";
import type {
  AuthResponse,
  ChangePasswordInput,
  DeleteAccountInput,
  EmailChangeConfirmInput,
  EmailChangeRequestInput,
  UpdateProfileInput,
  User,
} from "@/lib/api/types";

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

  updateProfile(input: UpdateProfileInput) {
    return api<User>("/auth/me", { method: "PATCH", json: input });
  },

  changePassword(input: ChangePasswordInput) {
    return api<void>("/auth/me/password", { method: "PATCH", json: input });
  },

  deleteAccount(input: DeleteAccountInput) {
    return api<void>("/auth/me", { method: "DELETE", json: input });
  },

  requestEmailChange(input: EmailChangeRequestInput) {
    return api<void>("/auth/me/email/change-request", {
      method: "POST",
      json: input,
    });
  },

  confirmEmailChange(input: EmailChangeConfirmInput) {
    return api<void>("/auth/email/confirm", { method: "POST", json: input });
  },
};

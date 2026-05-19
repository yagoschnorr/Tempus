import { describe, it, expect, beforeEach } from "vitest";
import { ReactNode } from "react";
import { act, renderHook } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/lib/auth/AuthContext";

const wrapper = ({ children }: { children: ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

const fakeUser = { id: "u-1", name: "Yago", email: "y@t.dev" };

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("começa sem usuário e sem token", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it("login persiste user/token no localStorage", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.login(fakeUser, "tk-123"));

    expect(result.current.user).toEqual(fakeUser);
    expect(result.current.token).toBe("tk-123");

    const raw = localStorage.getItem("tempus.auth");
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({ user: fakeUser, token: "tk-123" });
  });

  it("logout limpa estado e localStorage", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.login(fakeUser, "tk-1"));
    act(() => result.current.logout());

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem("tempus.auth")).toBeNull();
  });

  it("ao montar, restaura sessão salva no localStorage", () => {
    localStorage.setItem(
      "tempus.auth",
      JSON.stringify({ user: fakeUser, token: "saved-tk" })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toEqual(fakeUser);
    expect(result.current.token).toBe("saved-tk");
  });

  it("ignora payload corrompido no localStorage", () => {
    localStorage.setItem("tempus.auth", "isso-não-é-json");

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("tempus.auth")).toBeNull();
  });

  it("useAuth fora de AuthProvider lança erro", () => {
    expect(() => renderHook(() => useAuth())).toThrow(/AuthProvider/);
  });
});

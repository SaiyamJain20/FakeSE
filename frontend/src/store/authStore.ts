import { create } from "zustand";
import { apiFetch } from "../api/client";

type User = {
  id: string;
  username: string;
  email: string;
  role: "user" | "educator" | "admin";
  virtualBalance: string;
};

type AuthState = {
  token: string | null;
  user: User | null;
  loading: boolean;
  setToken: (token: string | null) => void;
  login: (input: { usernameOrEmail: string; password: string }) => Promise<void>;
  register: (input: { username: string; email: string; password: string; role?: "user" | "educator" }) => Promise<void>;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem("fakese-token"),
  user: null,
  loading: false,
  setToken: (token) => {
    if (token) {
      localStorage.setItem("fakese-token", token);
    } else {
      localStorage.removeItem("fakese-token");
    }
    set({ token });
  },
  login: async ({ usernameOrEmail, password }) => {
    set({ loading: true });
    try {
      const data = await apiFetch<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ usernameOrEmail, password })
      });
      get().setToken(data.token);
      set({ user: data.user });
    } finally {
      set({ loading: false });
    }
  },
  register: async ({ username, email, password, role }) => {
    set({ loading: true });
    try {
      const data = await apiFetch<{ token: string; user: User }>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password, role })
      });
      get().setToken(data.token);
      set({ user: data.user });
    } finally {
      set({ loading: false });
    }
  },
  logout: async () => {
    const token = get().token;
    if (token) {
      await apiFetch("/auth/logout", { method: "POST" }, token);
    }
    get().setToken(null);
    set({ user: null });
  }
}));

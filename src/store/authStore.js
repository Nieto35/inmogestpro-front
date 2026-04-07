// src/store/authStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

// Importar axios directamente para evitar circularidad con api.service
import axios from "axios";
import { resetSessionState } from "../services/api.service";

// ── FIX: decodeJWT faltaba en este archivo ────────────────────
const decodeJWT = (token) => {
  try {
    const payload = token.split(".")[1];
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const API_VERSION = '/api/v1';

const getAuthBase = () => {
    // Para autenticación, usamos la URL base sin slug
    const parts = window.location.pathname.split("/").filter(Boolean);
    const slug =
        parts[0] && parts[0] !== "super-admin"
            ? parts[0]
            : sessionStorage.getItem("inmogest_tenant");

    console.log(slug);

    const data = slug ? `${API_BASE_URL}${API_VERSION}/${slug}` : `${API_BASE_URL}${API_VERSION}`;

    console.log(data);
    return data
};


// API base dinámica según el tenant activo
const getBase = () => {
  const parts = window.location.pathname.split("/").filter(Boolean);
  const slug =
    parts[0] && parts[0] !== "super-admin"
      ? parts[0]
      : sessionStorage.getItem("inmogest_tenant");
  return slug ? `/api/v1/${slug}` : "/api/v1";
};

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isRedirecting: false,

      login: async (credentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await axios.post(
            `${getAuthBase()}/auth/login`,
            credentials,
            {
              headers: { "Content-Type": "application/json" },
            },
          );

          resetSessionState();
          const { token, refreshToken, user } = response.data.data;

          localStorage.setItem("inmogest_token", token);
          localStorage.setItem("inmogest_refresh", refreshToken);

          const payload = decodeJWT(token);
          if (payload?.tenantSlug) {
            sessionStorage.setItem("inmogest_tenant", payload.tenantSlug);
          }

          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            isRedirecting: false,
          });

          return { success: true };
        } catch (error) {
          const message =
            error.response?.data?.message || "Error al iniciar sesión";
          set({ isLoading: false, error: message, isAuthenticated: false });
          return { success: false, message };
        }
      },

      logout: async (reason = "") => {
        if (get().isRedirecting) return;
        set({ isRedirecting: true });

        try {
          const token = localStorage.getItem("inmogest_token");
          if (token) {
            await axios
              .post(
                `${getBase()}/auth/logout`,
                {},
                {
                  headers: { Authorization: `Bearer ${token}` },
                  timeout: 3000,
                },
              )
              .catch(() => {});
          }
        } finally {
          localStorage.removeItem("inmogest_token");
          localStorage.removeItem("inmogest_refresh");

          set({
            user: null,
            token: null,
            isAuthenticated: false,
            error: null,
            isRedirecting: false,
          });

          if (!window.location.pathname.includes("/login")) {
            const params = reason ? `?reason=${reason}` : "";
            const tenantSlug = sessionStorage.getItem("inmogest_tenant");
            const loginPath = tenantSlug
              ? `/${tenantSlug}/login${params}`
              : `/login${params}`;
            window.location.replace(loginPath);
          }
        }
      },

      refreshSession: async () => {
        const refreshToken = localStorage.getItem("inmogest_refresh");
        if (!refreshToken) return false;

        try {
          const response = await axios.post(
            `${getBase()}/auth/refresh`,
            { refreshToken },
            { timeout: 5000 },
          );
          const { token } = response.data?.data || {};
          if (token) {
            localStorage.setItem("inmogest_token", token);
            set({ token });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      checkAuth: async () => {
        const token = localStorage.getItem("inmogest_token");
        if (!token) {
          set({ isAuthenticated: false, user: null });
          return false;
        }
        try {
          const response = await axios.get(`${getBase()}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
            timeout: 5000,
          });
          set({ user: response.data.data, isAuthenticated: true });
          return true;
        } catch (error) {
          if (
            error.response?.status === 401 ||
            error.response?.status === 403
          ) {
            localStorage.removeItem("inmogest_token");
            set({ isAuthenticated: false, user: null, token: null });
          }
          return false;
        }
      },

      hasRole: (...roles) => roles.includes(get().user?.role),
      isAdmin: () => get().user?.role === "admin",
      isGerente: () => ["admin", "gerente"].includes(get().user?.role),
      isContador: () =>
        ["admin", "gerente", "contador"].includes(get().user?.role),
      clearError: () => set({ error: null }),
    }),
    {
      name: "inmogest_auth",
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    },
  ),
);

export default useAuthStore;
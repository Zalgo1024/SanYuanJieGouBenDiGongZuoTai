"use client";

import React, { createContext, useContext, useMemo } from "react";

export interface AuthUser { id: string; email: string; display_name: string; }
export interface AuthWorkspace { id: string; name: string; role: "owner" | "admin" | "editor" | "viewer"; }
interface AuthValue {
  loading: boolean;
  user: AuthUser | null;
  workspace: AuthWorkspace | null;
  workspaces: AuthWorkspace[];
  error: string;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; display_name: string; workspace_name: string }) => Promise<void>;
  logout: () => Promise<void>;
  selectWorkspace: (id: string) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

// 分析skill 后端无鉴权（本地单用户、数据全本机）。这里直接以固定本地工作区运行，
// 让依赖 auth?.workspace 的界面照常工作，无需登录。
const LOCAL_USER: AuthUser = { id: "local-user", email: "local@localhost", display_name: "本地使用者" };
const LOCAL_WORKSPACE: AuthWorkspace = { id: "local", name: "本地工作区", role: "owner" };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<AuthValue>(() => ({
    loading: false,
    user: LOCAL_USER,
    workspace: LOCAL_WORKSPACE,
    workspaces: [LOCAL_WORKSPACE],
    error: "",
    async login() { /* 本地模式无需登录 */ },
    async register() { /* 本地模式无需注册 */ },
    async logout() { /* 本地模式无需登出 */ },
    selectWorkspace() { /* 单一本地工作区 */ },
  }), []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider");
  return value;
}

export function useOptionalAuth() { return useContext(AuthContext); }

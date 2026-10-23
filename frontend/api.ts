import axios from "axios";
import type { Agendamento, AgendamentoCreate, Sala, Sessao, Usuario } from "./types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
  timeout: 15000,
});
const TOKEN_KEY = "salafacil.token";

export function encerrarSessao() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

export function temSessao() {
  return Boolean(localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY));
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use((response) => response, (error) => {
  if (axios.isAxiosError(error) && error.response?.status === 401 && error.config?.url !== "/auth/login") {
    encerrarSessao();
    window.dispatchEvent(new Event("salafacil:sessao-expirada"));
  }
  return Promise.reject(error);
});

export function mensagemErro(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return "Confira os campos preenchidos e tente novamente.";
    if (!error.response) return "Não foi possível conectar ao servidor. Verifique se a API está em execução.";
  }
  return "Não foi possível concluir a operação. Tente novamente.";
}

export async function entrar(email: string, senha: string, manterConectado: boolean): Promise<Usuario> {
  const { data } = await api.post<Sessao>("/auth/login", { email, senha });
  encerrarSessao();
  (manterConectado ? localStorage : sessionStorage).setItem(TOKEN_KEY, data.access_token);
  return data.usuario;
}
export async function getUsuario(): Promise<Usuario> {
  return (await api.get<Usuario>("/auth/me")).data;
}
export async function getSalas(): Promise<Sala[]> {
  return (await api.get<Sala[]>("/salas")).data;
}
export async function getAgendamentos(): Promise<Agendamento[]> {
  return (await api.get<Agendamento[]>("/agendamentos")).data;
}
export async function criarAgendamento(data: AgendamentoCreate): Promise<Agendamento> {
  return (await api.post<Agendamento>("/agendamentos", data)).data;
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  cargo: string;
}

export interface Sessao {
  access_token: string;
  usuario: Usuario;
}

export interface Sala {
  id: number;
  nome: string;
  capacidade: number;
  bloco: string;
  status: "Disponível" | "Ocupada";
  detalhe_status: string | null;
}

export interface AgendamentoCreate {
  atividade: string;
  data_agendamento: string;
  horario: string;
  sala_id: number;
}

export interface Agendamento extends AgendamentoCreate {
  id: number;
  usuario_id: number;
  responsavel: string;
  sala_nome: string;
  status: "Confirmado" | "Concluído";
}

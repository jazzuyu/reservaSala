import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { criarAgendamento, encerrarSessao, entrar, getAgendamentos, getSalas, getUsuario, mensagemErro, temSessao } from "./api";
import type { Agendamento, Sala, Usuario } from "./types";
import "./styles.css";

type Pagina = "inicio" | "agendamentos" | "salas";
type Icone = "calendario" | "casa" | "porta" | "busca" | "sair" | "sino" | "mais" | "fechar" | "check" | "local" | "relogio" | "email" | "cadeado" | "grafico" | "anterior" | "proximo";
const caminhos: Record<Icone, string> = {
  calendario: "M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2Z",
  casa: "m3 10 9-7 9 7M5 9v12h14V9M9 21v-8h6v8",
  porta: "M5 21h14M7 21V3h10v18M13 12h.01",
  busca: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
  sair: "M10 4H4v16h6m5-12 4 4-4 4m-7-4h11",
  sino: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4",
  mais: "M12 5v14M5 12h14", fechar: "m6 6 12 12M6 18 18 6", check: "m5 12 4 4L19 6",
  local: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  relogio: "M12 7v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z",
  email: "M3 5h18v14H3Zm0 0 9 8 9-8", cadeado: "M6 10h12v11H6Zm3 0V6a3 3 0 0 1 6 0v4",
  grafico: "M4 20h16M6 16v-5m6 5V4m6 12V8", anterior: "m15 6-6 6 6 6", proximo: "m9 6 6 6-6 6",
};
function Icon({ nome, size = 18 }: { nome: Icone; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={caminhos[nome]} /></svg>;
}
function Marca() {
  return <div className="marca"><span className="marca-icone"><Icon nome="calendario" size={21} /></span><div><strong>SalaFácil</strong><small>Gestão educacional</small></div></div>;
}
function hoje() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const parte = (nome: string) => partes.find(p => p.type === nome)!.value;
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}
function dataLocal(data: string) { return new Date(`${data}T12:00:00`); }
function chaveData(data: Date) { return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`; }
function somarDias(data: string, dias: number) { const d = dataLocal(data); d.setDate(d.getDate() + dias); return chaveData(d); }
function semana(data: string) {
  const dia = dataLocal(data).getDay();
  const segunda = somarDias(data, -(dia === 0 ? 6 : dia - 1));
  return Array.from({ length: 5 }, (_, i) => somarDias(segunda, i));
}
function formatar(data: string, opcoes: Intl.DateTimeFormatOptions) { return dataLocal(data).toLocaleDateString("pt-BR", opcoes); }
function horarios(horario: string) { return horario.split(/\s*[-–]\s*/); }
function minutos(hora: string) { const [h, m] = hora.split(":").map(Number); return h * 60 + m; }
function duracao(horario: string) {
  const [i, f] = horarios(horario); const n = minutos(f) - minutos(i);
  return `${Math.floor(n / 60) ? `${Math.floor(n / 60)}h` : ""}${n % 60 ? `${n % 60}min` : ""} de duração`;
}
function normalizar(texto: string) { return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function Erro({ texto }: { texto: string }) { return texto ? <div className="erro" role="alert">{texto}</div> : null; }
function Vazio({ texto }: { texto: string }) { return <div className="vazio"><Icon nome="calendario" size={28} /><p>{texto}</p></div>; }

function Login({ onEntrar }: { onEntrar: (usuario: Usuario) => void }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [manter, setManter] = useState(true);
  const [erro, setErro] = useState("");
  const [ajuda, setAjuda] = useState(false);
  const [enviando, setEnviando] = useState(false);
  async function enviar(event: FormEvent) {
    event.preventDefault(); setErro(""); setEnviando(true);
    try { onEntrar(await entrar(email.trim(), senha, manter)); }
    catch (e) { setErro(mensagemErro(e)); }
    finally { setEnviando(false); }
  }
  return <div className="login">
    <section className="login-apresentacao"><Marca /><div className="login-chamada"><span className="porta-grande"><Icon nome="porta" size={30} /></span><h1>Todos os espaços da sua<br />escola, organizados.</h1><p>Consulte salas disponíveis, faça reservas e acompanhe toda<br className="desktop" /> a agenda em um só lugar.</p></div><footer><span>✓ &nbsp; Reservas rápidas</span><span>✓ &nbsp; Agenda centralizada</span></footer></section>
    <main className="login-painel"><form onSubmit={enviar} className="login-form"><h2>Bem-vinda de volta</h2><p className="subtitulo">Entre com seus dados institucionais para acessar as salas.</p>
      <label htmlFor="email">E-mail institucional</label><div className="campo-icone"><Icon nome="email" /><input id="email" inputMode="email" autoComplete="username" maxLength={150} value={email} onChange={e => setEmail(e.target.value)} placeholder="seu.email@escola.edu.br" required /></div>
      <label htmlFor="senha">Senha</label><div className="campo-icone"><Icon nome="cadeado" /><input id="senha" type="password" autoComplete="current-password" maxLength={255} value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required /></div>
      <div className="login-opcoes"><label className="checkbox"><input type="checkbox" checked={manter} onChange={e => setManter(e.target.checked)} />Manter conectado</label><button type="button" className="link" onClick={() => setAjuda(!ajuda)}>Esqueci minha senha</button></div>
      {ajuda && <p className="aviso" role="status">Para recuperar seu acesso, entre em contato com a secretaria da sua instituição.</p>}
      <Erro texto={erro} /><button className="botao primario login-enviar" disabled={enviando}>{enviando ? "Entrando…" : "Entrar no sistema"}</button>
      <p className="login-rodape">Acesso exclusivo para colaboradores cadastrados.<br />Em caso de dúvidas, contate a secretaria.</p>
    </form></main>
  </div>;
}

interface ReservaProps {
  salas: Sala[];
  reservas: Agendamento[];
  salaInicial: number | null;
  dataInicial: string;
  onFechar: () => void;
  onSalvar: (reserva: Agendamento) => void;
}
function ReservaModal({ salas, reservas, salaInicial, dataInicial, onFechar, onSalvar }: ReservaProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [atividade, setAtividade] = useState("");
  const [data, setData] = useState(dataInicial < hoje() ? hoje() : dataInicial);
  const [inicio, setInicio] = useState("16:00");
  const [fim, setFim] = useState("17:30");
  const [salaId, setSalaId] = useState(salaInicial ? String(salaInicial) : "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const conflito = (id: number) => reservas.some(a => a.sala_id === id && a.data_agendamento === data && a.status === "Confirmado" && inicio < horarios(a.horario)[1] && fim > horarios(a.horario)[0]);
  async function salvar(event: FormEvent) {
    event.preventDefault(); setErro("");
    if (!atividade.trim()) { setErro("Informe o nome da atividade."); return; }
    if (inicio >= fim) { setErro("O término deve ser depois do início."); return; }
    if (conflito(Number(salaId))) { setErro("Esta sala já está reservada nesse horário. Escolha outro período."); return; }
    setSalvando(true);
    try {
      const reserva = await criarAgendamento({ atividade: atividade.trim(), data_agendamento: data, horario: `${inicio} - ${fim}`, sala_id: Number(salaId) });
      onSalvar(reserva); setConfirmado(true);
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setSalvando(false); }
  }
  return <dialog ref={dialog} className={`modal ${confirmado ? "modal-sucesso" : ""}`} aria-labelledby="modal-titulo" onCancel={e => { e.preventDefault(); if (!salvando) onFechar(); }} onClick={e => { if (e.target === e.currentTarget && !salvando) onFechar(); }}>
    {confirmado ? <><span className="sucesso-icone"><Icon nome="check" size={27} /></span><h2 id="modal-titulo">Agendamento confirmado</h2><p>A sala foi reservada e já está disponível na sua agenda semanal.</p><button autoFocus className="botao primario" onClick={onFechar}>Voltar para a agenda</button></> : <form onSubmit={salvar}>
      <div className="modal-cabecalho"><h2 id="modal-titulo">Novo agendamento</h2><button className="icone-botao" type="button" aria-label="Fechar" onClick={onFechar} disabled={salvando}><Icon nome="fechar" /></button></div>
      <p>Preencha os dados para reservar um espaço.</p>
      <fieldset disabled={salvando}><label htmlFor="atividade">Atividade</label><input id="atividade" autoFocus value={atividade} onChange={e => setAtividade(e.target.value)} maxLength={200} placeholder="Ex.: Aula de Biologia" required />
      <div className="form-linha"><div><label htmlFor="data">Data</label><input id="data" type="date" min={hoje()} value={data} onChange={e => setData(e.target.value)} required /></div><div><label htmlFor="inicio">Início</label><input id="inicio" type="time" value={inicio} onChange={e => setInicio(e.target.value)} required /></div><div><label htmlFor="fim">Término</label><input id="fim" type="time" value={fim} onChange={e => setFim(e.target.value)} required /></div></div>
      <label htmlFor="sala">Sala</label><select className={salaId ? "selecionado" : ""} id="sala" value={salaId} onChange={e => setSalaId(e.target.value)} required><option value="" disabled>Selecione um espaço</option>{salas.map(s => <option value={s.id} key={s.id} disabled={conflito(s.id)}>{s.nome} · {s.bloco}{conflito(s.id) ? " (reservada neste horário)" : ""}</option>)}</select>
      <Erro texto={erro} /><div className="modal-acoes"><button className="botao secundario" type="button" onClick={onFechar}>Cancelar</button><button className="botao primario" type="submit" disabled={!salas.length || salvando}>{salvando ? "Confirmando…" : "Confirmar agendamento"}</button></div></fieldset>
    </form>}
  </dialog>;
}

export default function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [verificando, setVerificando] = useState(temSessao);
  const [pagina, setPagina] = useState<Pagina>("inicio");
  const [salas, setSalas] = useState<Sala[]>([]);
  const [reservas, setReservas] = useState<Agendamento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("Todos");
  const [dataSelecionada, setDataSelecionada] = useState(hoje);
  const [modal, setModal] = useState<{ salaId: number | null } | null>(null);
  const [notificacoes, setNotificacoes] = useState(false);
  useEffect(() => {
    let ativo = true;
    if (temSessao()) getUsuario().then(u => { if (ativo) setUsuario(u); }).catch(e => { if (ativo) setErro(mensagemErro(e)); }).finally(() => { if (ativo) setVerificando(false); });
    const expirar = () => { setUsuario(null); setModal(null); setReservas([]); setSalas([]); setErro("Sua sessão expirou. Entre novamente."); };
    window.addEventListener("salafacil:sessao-expirada", expirar);
    return () => { ativo = false; window.removeEventListener("salafacil:sessao-expirada", expirar); };
  }, []);
  useEffect(() => {
    if (!usuario) return;
    let ativo = true;
    async function carregar(inicial = false) {
      if (inicial) setCarregando(true);
      try {
        const [s, a] = await Promise.all([getSalas(), getAgendamentos()]);
        if (ativo) { setSalas(s); setReservas(a); setErro(""); }
      } catch (e) { if (ativo) setErro(mensagemErro(e)); }
      finally { if (ativo) setCarregando(false); }
    }
    void carregar(true);
    const timer = window.setInterval(() => void carregar(), 60000);
    const atualizar = () => void carregar();
    window.addEventListener("focus", atualizar);
    window.addEventListener("salafacil:atualizar", atualizar);
    return () => { ativo = false; clearInterval(timer); window.removeEventListener("focus", atualizar); window.removeEventListener("salafacil:atualizar", atualizar); };
  }, [usuario]);
  function navegar(p: Pagina) { setPagina(p); setBusca(""); setNotificacoes(false); }
  function sair() { encerrarSessao(); setUsuario(null); setReservas([]); setSalas([]); setModal(null); setErro(""); setPagina("inicio"); setBusca(""); }
  const dias = semana(dataSelecionada);
  const termo = normalizar(busca.trim());
  const combina = (a: Agendamento) => normalizar(`${a.atividade} ${a.sala_nome} ${a.responsavel}`).includes(termo);
  const agendaDia = reservas.filter(a => a.data_agendamento === dataSelecionada && combina(a));
  const proximos = reservas.filter(a => a.status === "Confirmado");
  const concluidos = reservas.filter(a => a.status === "Concluído");
  const listaReservas = reservas.filter(a => combina(a) && (filtro === "Todos" || (filtro === "Próximos" ? a.status === "Confirmado" : a.status === "Concluído")));
  const listaSalas = salas.filter(s => normalizar(`${s.nome} ${s.bloco} ${s.capacidade}`).includes(termo));
  // Referência de ocupação: segunda a sexta, das 8h às 18h.
  const minutosReservados = reservas.filter(a => dias.includes(a.data_agendamento)).reduce((total, a) => {
    const [i, f] = horarios(a.horario); return total + Math.max(0, Math.min(1080, minutos(f)) - Math.max(480, minutos(i)));
  }, 0);
  const ocupacao = salas.length ? Math.min(100, Math.round(minutosReservados / (salas.length * 5 * 600) * 100)) : 0;
  const novo = (salaId: number | null = null) => { setNotificacoes(false); setModal({ salaId }); };
  if (verificando) return <div className="carregamento" role="status"><Marca /><p>Carregando sua sessão…</p></div>;
  if (!usuario) return <><Login onEntrar={u => { setErro(""); setUsuario(u); }} />{erro && <div className="erro-sessao" role="alert">{erro}</div>}</>;
  return <div className="app">
    <aside className="sidebar"><Marca /><span className="menu-legenda">Menu principal</span><nav aria-label="Menu principal">{([ ["inicio", "casa", "Início"], ["agendamentos", "calendario", "Agendamentos"], ["salas", "porta", "Salas"] ] as const).map(([id, icone, nome]) => <button key={id} className={`nav-item ${pagina === id ? "ativo" : ""}`} aria-current={pagina === id ? "page" : undefined} onClick={() => navegar(id)}><Icon nome={icone} /><span>{nome}</span>{id === "agendamentos" && <span className="contador">{reservas.length}</span>}</button>)}</nav><div className="sidebar-rodape"><button className="nav-item" onClick={sair}><Icon nome="sair" /><span>Sair do sistema</span></button><div className="perfil"><span className="avatar">{usuario.nome.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("")}</span><div><strong>{usuario.nome}</strong><small>{usuario.cargo}</small></div><button className="icone-botao" aria-label="Sair do sistema" onClick={sair}><Icon nome="sair" /></button></div></div></aside>
    <div className="app-corpo"><header className="topbar"><div className="busca-global"><Icon nome="busca" size={15} /><input aria-label="Buscar salas e agendamentos" placeholder="Buscar salas, agendamentos…" value={busca} onChange={e => setBusca(e.target.value)} /></div><div className="topbar-acoes"><div className="notificacoes"><button className="icone-botao sino" aria-label="Ver próximos agendamentos" aria-expanded={notificacoes} onClick={() => setNotificacoes(!notificacoes)}><Icon nome="sino" />{proximos.length > 0 && <i />}</button>{notificacoes && <div className="notificacoes-painel"><strong>Próximos agendamentos</strong>{proximos.slice(0, 3).map(a => <button key={a.id} onClick={() => { navegar("agendamentos"); setFiltro("Próximos"); }}><b>{a.atividade}</b><small>{formatar(a.data_agendamento, { day: "2-digit", month: "short" })} · {a.horario}</small></button>)}{!proximos.length && <p>Nenhum agendamento próximo.</p>}</div>}</div><button className="botao primario" disabled={carregando || !salas.length} onClick={() => novo()}><Icon nome="mais" size={15} />Novo agendamento</button></div></header>
    <main className="conteudo"><div className="pagina-cabecalho"><div><span className="sobretitulo">{pagina === "inicio" ? formatar(dataSelecionada, { weekday: "long", day: "numeric", month: "long" }) : pagina === "agendamentos" ? "Gestão de reservas" : "Espaços da instituição"}</span><h1>{pagina === "inicio" ? `Olá, ${usuario.nome.split(" ")[0]}!` : pagina === "agendamentos" ? "Agendamentos" : "Salas disponíveis"}</h1><p>{pagina === "inicio" ? "Acompanhe os espaços e compromissos da sua instituição." : pagina === "agendamentos" ? "Consulte e gerencie todos os agendamentos gerados." : "Encontre o melhor espaço para sua próxima atividade."}</p></div>{pagina === "inicio" ? <div className="navegar-semana"><button className="icone-botao" aria-label="Semana anterior" onClick={() => setDataSelecionada(somarDias(dataSelecionada, -7))}><Icon nome="anterior" size={14} /></button><span>{formatar(dias[0], { day: "2-digit", month: "short" })} – {formatar(dias[4], { day: "2-digit", month: "short", year: "numeric" })}</span><button className="icone-botao" aria-label="Próxima semana" onClick={() => setDataSelecionada(somarDias(dataSelecionada, 7))}><Icon nome="proximo" size={14} /></button></div> : pagina === "agendamentos" && <button className="botao primario" onClick={() => novo()} disabled={carregando || !salas.length}><Icon nome="mais" size={15} />Novo agendamento</button>}</div>
      {erro && <div className="erro-linha"><Erro texto={erro} /><button className="link" onClick={() => window.dispatchEvent(new Event("salafacil:atualizar"))}>Tentar novamente</button></div>}
      {carregando ? <div className="vazio" role="status">Carregando salas e agendamentos…</div> : <>
      {pagina === "inicio" && <><div className="semana" aria-label="Dias da semana">{dias.map(d => <button key={d} className={d === dataSelecionada ? "selecionado" : ""} aria-pressed={d === dataSelecionada} onClick={() => setDataSelecionada(d)}><small>{formatar(d, { weekday: "short" }).replace(".", "")}</small><strong>{dataLocal(d).getDate()}</strong></button>)}</div>
      <div className="dashboard"><section><div className="secao-cabecalho"><div><h2>Agenda do dia</h2><small>{agendaDia.length} {agendaDia.length === 1 ? "atividade programada" : "atividades programadas"}</small></div><button className="link" onClick={() => navegar("agendamentos")}>Ver agenda completa</button></div><div className="agenda-dia">{agendaDia.map((a, i) => <article className={`agenda-card cor-${i % 3}`} key={a.id}><div className="agenda-hora"><strong>{horarios(a.horario)[0]}</strong><small>{horarios(a.horario)[1]}</small></div><div className="agenda-info"><h3>{a.atividade}</h3><p>{a.responsavel}</p><div className="agenda-meta"><span className="sala-tag"><Icon nome="local" size={12} />{a.sala_nome}</span><small><Icon nome="relogio" size={12} />{duracao(a.horario)}</small></div></div></article>)}{!agendaDia.length && <Vazio texto={busca ? "Nenhuma atividade encontrada para esta busca." : "Nenhuma atividade programada para este dia."} />}</div></section>
      <section><div className="secao-cabecalho"><div><h2>Salas agora</h2><small>Disponibilidade em tempo real · atualiza a cada minuto</small></div><button className="link" onClick={() => navegar("salas")}>Ver todas</button></div><div className="salas-resumo painel">{listaSalas.map(s => <div className="sala-resumo" key={s.id}><span className={`porta-icone ${s.status === "Ocupada" ? "ocupada" : ""}`}><Icon nome="porta" size={18} /></span><div><h3>{s.nome}</h3><small>{s.capacidade} lugares · {s.bloco}</small></div><span className={`status-texto ${s.status === "Ocupada" ? "ocupada" : ""}`}>● {s.detalhe_status || s.status}</span></div>)}{!listaSalas.length && <Vazio texto="Nenhuma sala encontrada." />}<button className="reservar-livre" onClick={() => novo(salas.find(s => s.status === "Disponível")?.id ?? null)} disabled={!salas.length}><Icon nome="mais" size={14} />Reservar uma sala livre</button></div><div className="ocupacao"><div>Ocupação semanal <Icon nome="grafico" size={17} /></div><strong>{ocupacao}%</strong><div className="progresso" role="progressbar" aria-label="Ocupação semanal" aria-valuenow={ocupacao} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${ocupacao}%` }} /></div><small>Semana selecionada · seg. a sex., das 8h às 18h.</small></div></section></div></>}
      {pagina === "agendamentos" && <><div className="filtros" aria-label="Filtrar agendamentos">{[["Todos", reservas.length], ["Próximos", proximos.length], ["Concluídos", concluidos.length]].map(([nome, total]) => <button key={nome} className={`botao ${filtro === nome ? "filtro-ativo" : "secundario"}`} aria-pressed={filtro === nome} onClick={() => setFiltro(String(nome))}>{nome} {total}</button>)}</div><section className="painel lista-agendamentos" aria-label="Agendamentos">{listaReservas.map((a, i) => <article className={`agendamento-linha cor-${i % 3}`} key={a.id}><div className="agendamento-data"><strong>{formatar(a.data_agendamento, { day: "2-digit", month: "short" }).replace(" de ", " ").replace(".", "")}</strong><small>{a.horario}</small><small>{dataLocal(a.data_agendamento).getFullYear()}</small></div><div className="agendamento-atividade"><h3>{a.atividade}</h3><p>{a.responsavel}</p></div><span className="sala-tag"><Icon nome="local" size={12} />{a.sala_nome}</span><span className={`badge ${a.status === "Concluído" ? "concluido" : ""}`}>{a.status}</span></article>)}{!listaReservas.length && <Vazio texto="Nenhum agendamento encontrado para este filtro." />}<footer>Mostrando {listaReservas.length} de {reservas.length} agendamentos</footer></section></>}
      {pagina === "salas" && <><div className="busca-salas painel"><Icon nome="busca" size={17} /><input aria-label="Buscar salas por nome, bloco ou capacidade" placeholder="Buscar por nome, bloco ou capacidade…" value={busca} onChange={e => setBusca(e.target.value)} /><span>{listaSalas.length} espaços</span></div><section className="salas-grid" aria-label="Salas da instituição">{listaSalas.map(s => <article className="sala-card painel" key={s.id}><div className="sala-card-topo"><span className={`porta-icone ${s.status === "Ocupada" ? "ocupada" : ""}`}><Icon nome="porta" /></span><span className={`badge ${s.status === "Ocupada" ? "ocupada" : ""}`}>● {s.status}</span></div><h2>{s.nome}</h2><p>{s.capacidade} lugares · {s.bloco}</p><footer><small>{s.detalhe_status || s.status}</small><button className="link" onClick={() => { if (s.status === "Ocupada") { navegar("agendamentos"); setBusca(s.nome); } else novo(s.id); }}>{s.status === "Ocupada" ? "Ver agenda" : "Agendar"}</button></footer></article>)}</section>{!listaSalas.length && <Vazio texto="Nenhuma sala encontrada." />}</>}
      </>}
    </main></div>
    {modal && <ReservaModal salas={salas} reservas={reservas} salaInicial={modal.salaId} dataInicial={dataSelecionada} onFechar={() => setModal(null)} onSalvar={a => { setReservas(atuais => [...atuais.filter(item => item.id !== a.id), a].sort((x, y) => `${x.data_agendamento} ${x.horario}`.localeCompare(`${y.data_agendamento} ${y.horario}`))); setDataSelecionada(a.data_agendamento); setBusca(""); setFiltro("Todos"); setPagina("inicio"); window.dispatchEvent(new Event("salafacil:atualizar")); }} />}
  </div>;
}

"""API SalaFácil. Execute com: uvicorn main:app --reload."""

import base64
import binascii
import hashlib
import hmac
import os
import re
import secrets
import time
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy import Column, Date, ForeignKey, Integer, String, create_engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, declarative_base, sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "mysql+mysqlconnector://root:@localhost:3306/salafacil")
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
try:
    TIMEZONE = ZoneInfo("America/Sao_Paulo")
except ZoneInfoNotFoundError:
    # O Windows pode não ter a base IANA instalada. São Paulo usa UTC-3.
    TIMEZONE = timezone(timedelta(hours=-3), "America/Sao_Paulo")
# Defina SESSION_SECRET para preservar as sessões entre reinicializações/workers.
SESSION_SECRET = os.getenv("SESSION_SECRET", secrets.token_hex(32)).encode()
security = HTTPBearer(auto_error=False)

app = FastAPI(title="SalaFácil API", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


class UsuarioModel(Base):
    __tablename__ = "usuarios"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    senha = Column(String(255), nullable=False)
    cargo = Column(String(100), default="Coordenação")


class SalaModel(Base):
    __tablename__ = "salas"
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    capacidade = Column(Integer, nullable=False)
    bloco = Column(String(50), nullable=False)
    status = Column(String(50), default="Disponível")
    detalhe_status = Column(String(100))


class AgendamentoModel(Base):
    __tablename__ = "agendamentos"
    id = Column(Integer, primary_key=True, index=True)
    atividade = Column(String(200), nullable=False)
    data_agendamento = Column(Date, nullable=False)
    horario = Column(String(50), nullable=False)
    sala_id = Column(Integer, ForeignKey("salas.id"), nullable=False)
    usuario_id = Column(Integer, ForeignKey("usuarios.id"), nullable=False)
    status = Column(String(50), default="Confirmado")


class UsuarioOut(BaseModel):
    id: int
    nome: str
    email: str
    cargo: str


class LoginCreate(BaseModel):
    email: str = Field(min_length=3, max_length=150)
    senha: str = Field(min_length=1, max_length=255)


class SessaoOut(BaseModel):
    access_token: str
    usuario: UsuarioOut


class SalaOut(BaseModel):
    id: int
    nome: str
    capacidade: int
    bloco: str
    status: str
    detalhe_status: Optional[str] = None


class AgendamentoCreate(BaseModel):
    atividade: str = Field(min_length=1, max_length=200)
    data_agendamento: date
    horario: str = Field(pattern=r"^\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2}$")
    sala_id: int = Field(gt=0)


class AgendamentoOut(BaseModel):
    id: int
    atividade: str
    data_agendamento: date
    horario: str
    sala_id: int
    usuario_id: int
    responsavel: str
    sala_nome: str
    status: str


def agora():
    return datetime.now(TIMEZONE)


def get_db():
    db = SessionLocal()
    try:
        yield db
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(503, "Não foi possível acessar o banco de dados. Tente novamente.") from exc
    finally:
        db.close()


def usuario_out(usuario):
    return UsuarioOut(id=usuario.id, nome=usuario.nome, email=usuario.email,
                      cargo=usuario.cargo or "Colaborador")


def hash_senha(senha):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt.encode(), 600_000).hex()
    return f"pbkdf2_sha256${salt}${digest}"


def verificar_senha(senha, armazenada):
    if armazenada.startswith("pbkdf2_sha256$"):
        try:
            _, salt, digest = armazenada.split("$")
            calculado = hashlib.pbkdf2_hmac("sha256", senha.encode(), salt.encode(), 600_000).hex()
            return hmac.compare_digest(calculado, digest)
        except ValueError:
            return False
    # Compatibilidade com o schema.sql existente; migra a senha no primeiro login.
    return hmac.compare_digest(senha.encode(), armazenada.encode())


def criar_token(usuario_id):
    payload = f"{usuario_id}:{int(time.time()) + 60 * 60 * 24}:{secrets.token_hex(16)}"
    assinatura = hmac.new(SESSION_SECRET, payload.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}:{assinatura}".encode()).decode()


def usuario_atual(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
                  db: Session = Depends(get_db)):
    try:
        if credentials is None:
            raise ValueError()
        texto = base64.urlsafe_b64decode(credentials.credentials).decode()
        usuario_id, expiracao, nonce, assinatura = texto.split(":")
        payload = f"{usuario_id}:{expiracao}:{nonce}"
        esperado = hmac.new(SESSION_SECRET, payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(assinatura, esperado) or int(expiracao) <= time.time():
            raise ValueError()
        usuario = db.get(UsuarioModel, int(usuario_id))
        if usuario is None:
            raise ValueError()
        return usuario
    except (ValueError, UnicodeError, binascii.Error):
        raise HTTPException(401, "Sua sessão expirou. Entre novamente.",
                            headers={"WWW-Authenticate": "Bearer"})


def intervalo(horario):
    try:
        inicio, fim = re.split(r"\s*[-–]\s*", horario)
        inicio = datetime.strptime(inicio, "%H:%M").time()
        fim = datetime.strptime(fim, "%H:%M").time()
        if inicio >= fim:
            raise ValueError()
        return inicio.hour * 60 + inicio.minute, fim.hour * 60 + fim.minute
    except ValueError as exc:
        raise HTTPException(422, "Informe um horário válido, com o término após o início.") from exc


def agendamento_out(item, sala_nome, responsavel, momento=None):
    momento = momento or agora()
    _, fim = intervalo(item.horario)
    concluido = item.data_agendamento < momento.date() or (
        item.data_agendamento == momento.date() and fim <= momento.hour * 60 + momento.minute
    )
    return AgendamentoOut(
        id=item.id, atividade=item.atividade, data_agendamento=item.data_agendamento,
        horario=item.horario, sala_id=item.sala_id, usuario_id=item.usuario_id,
        sala_nome=sala_nome, responsavel=responsavel,
        status="Concluído" if concluido else "Confirmado",
    )


@app.post("/auth/login", response_model=SessaoOut)
def login(item: LoginCreate, db: Session = Depends(get_db)):
    usuario = db.query(UsuarioModel).filter(UsuarioModel.email == item.email.strip()).first()
    if usuario is None or not verificar_senha(item.senha, usuario.senha):
        raise HTTPException(401, "E-mail ou senha incorretos.")
    if not usuario.senha.startswith("pbkdf2_sha256$"):
        usuario.senha = hash_senha(item.senha)
        db.commit()
    return SessaoOut(access_token=criar_token(usuario.id), usuario=usuario_out(usuario))


@app.get("/auth/me", response_model=UsuarioOut)
def perfil(usuario: UsuarioModel = Depends(usuario_atual)):
    return usuario_out(usuario)


@app.get("/salas", response_model=list[SalaOut])
def listar_salas(db: Session = Depends(get_db), _usuario=Depends(usuario_atual)):
    momento = agora()
    minuto = momento.hour * 60 + momento.minute
    reservas = db.query(AgendamentoModel).filter(
        AgendamentoModel.data_agendamento == momento.date(),
        AgendamentoModel.status == "Confirmado",
    ).all()
    resultado = []
    for sala in db.query(SalaModel).order_by(SalaModel.id).all():
        horarios = sorted(intervalo(a.horario) for a in reservas if a.sala_id == sala.id)
        atual = next(((i, f) for i, f in horarios if i <= minuto < f), None)
        proximo = next((i for i, _ in horarios if i > minuto), None)
        detalhe = "Livre o dia todo" if not horarios else "Livre pelo restante do dia"
        if atual:
            detalhe = f"Ocupada até {atual[1] // 60:02d}:{atual[1] % 60:02d}"
        elif proximo is not None:
            detalhe = f"Livre até {proximo // 60:02d}:{proximo % 60:02d}"
        resultado.append(SalaOut(id=sala.id, nome=sala.nome, capacidade=sala.capacidade,
                                 bloco=sala.bloco, status="Ocupada" if atual else "Disponível",
                                 detalhe_status=detalhe))
    return resultado


@app.get("/agendamentos", response_model=list[AgendamentoOut])
def listar_agendamentos(db: Session = Depends(get_db), _usuario=Depends(usuario_atual)):
    registros = db.query(AgendamentoModel, SalaModel.nome, UsuarioModel.nome).join(
        SalaModel, AgendamentoModel.sala_id == SalaModel.id
    ).join(UsuarioModel, AgendamentoModel.usuario_id == UsuarioModel.id).order_by(
        AgendamentoModel.data_agendamento, AgendamentoModel.horario
    ).all()
    momento = agora()
    return [agendamento_out(item, sala, nome, momento) for item, sala, nome in registros]


@app.post("/agendamentos", response_model=AgendamentoOut, status_code=201)
def criar_agendamento(item: AgendamentoCreate, db: Session = Depends(get_db),
                      usuario=Depends(usuario_atual)):
    atividade = item.atividade.strip()
    if not atividade:
        raise HTTPException(422, "Informe o nome da atividade.")
    inicio, fim = intervalo(item.horario)
    momento = agora()
    if item.data_agendamento < momento.date() or (
        item.data_agendamento == momento.date() and inicio <= momento.hour * 60 + momento.minute
    ):
        raise HTTPException(422, "Escolha uma data e um horário futuros.")
    # Serializa as reservas da mesma sala no MySQL para evitar conflitos concorrentes.
    sala = db.query(SalaModel).filter(SalaModel.id == item.sala_id).with_for_update().first()
    if sala is None:
        raise HTTPException(404, "Sala não encontrada.")
    reservas = db.query(AgendamentoModel).filter(
        AgendamentoModel.sala_id == item.sala_id,
        AgendamentoModel.data_agendamento == item.data_agendamento,
        AgendamentoModel.status == "Confirmado",
    ).with_for_update().all()
    for reserva in reservas:
        outro_inicio, outro_fim = intervalo(reserva.horario)
        if inicio < outro_fim and fim > outro_inicio:
            raise HTTPException(409, "Esta sala já está reservada nesse horário. Escolha outro período.")
    novo = AgendamentoModel(
        atividade=atividade, data_agendamento=item.data_agendamento,
        horario=f"{inicio // 60:02d}:{inicio % 60:02d} - {fim // 60:02d}:{fim % 60:02d}",
        sala_id=sala.id, usuario_id=usuario.id, status="Confirmado",
    )
    db.add(novo)
    db.commit()
    db.refresh(novo)
    return agendamento_out(novo, sala.nome, usuario.nome)

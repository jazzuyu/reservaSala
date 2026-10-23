"""Testes isolados em SQLite; não acessam o banco MySQL da aplicação."""

import os
import unittest
from datetime import date, datetime
from unittest.mock import patch

os.environ["DATABASE_URL"] = "sqlite://"

import main
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


class ReservaTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        main.Base.metadata.create_all(self.engine)
        self.db = sessionmaker(bind=self.engine)()
        self.usuario = main.UsuarioModel(nome="Ana Silva", email="ana@escola.edu.br",
                                         senha="senha-de-teste", cargo="Coordenação")
        self.sala = main.SalaModel(nome="Sala 101", capacidade=30, bloco="Bloco A")
        self.outra = main.SalaModel(nome="Laboratório", capacidade=24, bloco="Bloco C")
        self.db.add_all([self.usuario, self.sala, self.outra])
        self.db.commit()
        self.clock = patch.object(main, "agora", return_value=datetime(2030, 8, 14, 9, 0, tzinfo=main.TIMEZONE))
        self.clock.start()

    def tearDown(self):
        self.clock.stop()
        self.db.close()
        self.engine.dispose()

    def reservar(self, horario="10:00 - 11:30", dia="2030-08-14", sala_id=None, atividade="Aula de Biologia"):
        dados = main.AgendamentoCreate(atividade=atividade, data_agendamento=dia,
                                       horario=horario, sala_id=sala_id or self.sala.id)
        return main.criar_agendamento(dados, self.db, self.usuario)

    def assert_http(self, codigo, callback):
        with self.assertRaises(HTTPException) as erro:
            callback()
        self.assertEqual(erro.exception.status_code, codigo)

    def test_criar_listar_e_identificar_responsavel(self):
        reserva = self.reservar(atividade="  Aula de Biologia  ")
        self.assertEqual(reserva.atividade, "Aula de Biologia")
        self.assertEqual(reserva.usuario_id, self.usuario.id)
        self.assertEqual(reserva.responsavel, "Ana Silva")
        self.assertEqual(reserva.sala_nome, "Sala 101")
        self.assertEqual(reserva.status, "Confirmado")
        self.assertEqual(len(main.listar_agendamentos(self.db, self.usuario)), 1)

    def test_rejeitar_sobreposicoes(self):
        self.reservar()
        for horario in ["10:00 - 11:30", "09:30 - 10:30", "11:00 - 12:00", "09:30 - 12:00", "10:30 - 11:00"]:
            self.assert_http(409, lambda h=horario: self.reservar(h))
        self.assertEqual(self.db.query(main.AgendamentoModel).count(), 1)

    def test_aceitar_periodos_adjacentes_e_outras_salas(self):
        self.reservar()
        self.reservar("11:30 - 12:00")
        self.reservar(sala_id=self.outra.id)
        self.reservar(dia="2030-08-15")
        self.assertEqual(self.db.query(main.AgendamentoModel).count(), 4)

    def test_rejeitar_datas_passadas_e_inicio_passado(self):
        self.assert_http(422, lambda: self.reservar(dia="2030-08-13"))
        self.assert_http(422, lambda: self.reservar("08:30 - 10:00"))
        self.assert_http(422, lambda: self.reservar("09:00 - 10:00"))

    def test_rejeitar_horarios_invalidos(self):
        for horario in ["11:30 - 10:00", "10:00 - 10:00", "25:00 - 26:00", "10:65 - 11:30"]:
            self.assert_http(422, lambda h=horario: self.reservar(h))
        with self.assertRaises(ValidationError):
            self.reservar("qualquer coisa")

    def test_sala_inexistente_e_atividade_em_branco(self):
        self.assert_http(404, lambda: self.reservar(sala_id=999))
        self.assert_http(422, lambda: self.reservar(atividade="   "))

    def test_disponibilidade_e_conclusao_por_horario(self):
        self.reservar()
        self.assertEqual(main.listar_salas(self.db, self.usuario)[0].detalhe_status, "Livre até 10:00")
        with patch.object(main, "agora", return_value=datetime(2030, 8, 14, 10, 0, tzinfo=main.TIMEZONE)):
            sala = main.listar_salas(self.db, self.usuario)[0]
            self.assertEqual(sala.status, "Ocupada")
            self.assertEqual(sala.detalhe_status, "Ocupada até 11:30")
        with patch.object(main, "agora", return_value=datetime(2030, 8, 14, 11, 30, tzinfo=main.TIMEZONE)):
            self.assertEqual(main.listar_salas(self.db, self.usuario)[0].status, "Disponível")
            self.assertEqual(main.listar_agendamentos(self.db, self.usuario)[0].status, "Concluído")

    def test_login_e_migracao_da_senha_existente(self):
        sessao = main.login(main.LoginCreate(email=self.usuario.email, senha="senha-de-teste"), self.db)
        self.assertEqual(sessao.usuario.id, self.usuario.id)
        self.assertTrue(self.usuario.senha.startswith("pbkdf2_sha256$"))
        self.assertTrue(main.verificar_senha("senha-de-teste", self.usuario.senha))
        self.assertFalse(main.verificar_senha("errada", self.usuario.senha))
        credenciais = HTTPAuthorizationCredentials(scheme="Bearer", credentials=sessao.access_token)
        self.assertEqual(main.usuario_atual(credenciais, self.db).id, self.usuario.id)

    def test_rejeitar_login_invalido(self):
        self.assert_http(401, lambda: main.login(main.LoginCreate(email=self.usuario.email, senha="errada"), self.db))
        self.assert_http(401, lambda: main.login(main.LoginCreate(email="inexistente@escola.edu.br", senha="errada"), self.db))

    def test_rejeitar_tokens_invalidos_expirados_ou_adulterados(self):
        self.assert_http(401, lambda: main.usuario_atual(None, self.db))
        for token in ["invalido", "%%%%", main.criar_token(self.usuario.id)[:-4] + "AAAA"]:
            credenciais = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
            self.assert_http(401, lambda c=credenciais: main.usuario_atual(c, self.db))
        with patch.object(main.time, "time", return_value=1):
            token = main.criar_token(self.usuario.id)
        credenciais = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        self.assert_http(401, lambda: main.usuario_atual(credenciais, self.db))


if __name__ == "__main__":
    unittest.main()

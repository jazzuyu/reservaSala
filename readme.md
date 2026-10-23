# SalaFácil

O SalaFácil é um trabalho acadêmico desenvolvido para a disciplina **Análise e Projeto de Sistemas II**, do curso de **Sistemas de Informação**.

O projeto tem como objetivo organizar a consulta e a reserva de salas em uma instituição de ensino. A interface segue o protótipo elaborado no Word e permite acompanhar a agenda, consultar a disponibilidade dos espaços e criar agendamentos.

## Tecnologias

- **Frontend:** React, TypeScript e Vite.
- **Backend:** Python, FastAPI e SQLAlchemy.
- **Banco de dados:** MySQL.

## Pré-requisitos

Tenha Python, Node.js com npm e MySQL instalados. O serviço do MySQL deve estar em execução.

As instruções abaixo utilizam o terminal **PowerShell no Windows**. Comece na pasta raiz do projeto, onde estão `main.py` e `schema.sql`.

## 1. Preparar o banco de dados

Na primeira configuração, abra o arquivo `schema.sql` no MySQL Workbench e execute o script. Ele cria o banco `salafacil`, as tabelas e os registros iniciais de usuário e salas.

Se o banco e as tabelas já estiverem configurados, pule esta etapa. O script contém comandos de criação de tabelas e inserção de dados que não devem ser repetidos em um banco já preparado.

**Atenção ao login:** o e-mail do usuário de exemplo em `schema.sql` contém `;com` no lugar de `.com`. Corrija esse valor antes de importar o script. Se já importou, ajuste o registro na tabela `usuarios` ou utilize o e-mail exatamente como está salvo. A senha inicial está no mesmo comando `INSERT` do script e serve para demonstração acadêmica.

## 2. Rodar o backend

Na raiz do projeto, crie um ambiente virtual:

```powershell
python -m venv .venv
```

Instale as dependências usando o Python desse ambiente:

```powershell
.\.venv\Scripts\python.exe -m pip install fastapi uvicorn "pydantic>=2,<3" "sqlalchemy>=2,<3" mysql-connector-python tzdata
```

Por padrão, a API conecta ao MySQL em `localhost:3306`, no banco `salafacil`, com o usuário `root` e sem senha. Se sua configuração for diferente, defina a variável abaixo **no terminal em que vai iniciar o backend**, substituindo os valores de exemplo:

```powershell
$env:DATABASE_URL = "mysql+mysqlconnector://usuario:senha@localhost:3306/salafacil"
```

Se a senha contiver caracteres especiais, codifique-os para uso em uma URL de conexão.

Inicie a API:

```powershell
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

- API: <http://localhost:8000>
- Documentação interativa: <http://localhost:8000/docs>

A raiz `/` não possui uma página cadastrada. Para conferir a API pelo navegador, utilize `/docs`.

Mantenha esse terminal aberto enquanto usa o sistema.

## 3. Rodar o frontend

Abra **outro terminal** na raiz do projeto e entre na pasta do frontend:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev -- --port 5173 --strictPort
```

Acesse **<http://localhost:5173>** e entre com o e-mail e a senha do usuário cadastrado na tabela `usuarios`.

O frontend se conecta à API em `http://localhost:8000`. O backend e o frontend precisam estar rodando ao mesmo tempo. Para encerrar cada servidor, pressione `Ctrl+C` no respectivo terminal.

## Configurações opcionais

As variáveis abaixo permitem adaptar os endereços sem editar o código:

| Variável | Onde definir | Finalidade |
| --- | --- | --- |
| `DATABASE_URL` | Terminal do backend | Configurar a conexão com o MySQL. |
| `FRONTEND_ORIGINS` | Terminal do backend | Informar as origens permitidas pelo CORS, separadas por vírgula. Por padrão, permite `http://localhost:5173` e `http://127.0.0.1:5173`. |
| `SESSION_SECRET` | Terminal do backend | Definir um segredo privado e estável para assinar as sessões. Sem essa variável, reiniciar a API exige um novo login. |
| `VITE_API_URL` | Terminal do frontend ou arquivo `frontend/.env.local` | Alterar o endereço da API. Reinicie o Vite após mudar esse valor. |

Exemplo de configuração em `frontend/.env.local`:

```dotenv
VITE_API_URL=http://localhost:8000
```

As variáveis do backend são lidas do ambiente do processo. O backend não carrega arquivos `.env` automaticamente.

## Verificações

Para verificar os tipos e gerar a versão de produção do frontend, execute na pasta `frontend`:

```powershell
npm.cmd run build
```

Os arquivos gerados ficam em `frontend/dist`.

Para executar os testes do backend, rode na raiz do projeto:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Os testes utilizam um banco SQLite em memória e não alteram o banco MySQL.

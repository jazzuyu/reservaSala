CREATE DATABASE IF NOT EXISTS salafacil;
USE salafacil;

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cargo VARCHAR(100) DEFAULT 'Coordenação'
);

CREATE TABLE salas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    capacidade INT NOT NULL,
    bloco VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'Disponível',
    detalhe_status VARCHAR(100) 
);

CREATE TABLE agendamentos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    atividade VARCHAR(200) NOT NULL,
    data_agendamento DATE NOT NULL,
    horario VARCHAR(50) NOT NULL,
    sala_id INT,
    usuario_id INT,
    status VARCHAR(50) DEFAULT 'Confirmado',
    FOREIGN KEY (sala_id) REFERENCES salas(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

INSERT INTO usuarios (nome, email, senha, cargo) VALUES 
('Carla Furtado', 'carlayfurtadoa@gmail;com', '123456', 'Coordenação');

INSERT INTO salas (nome, capacidade, bloco, status, detalhe_status) VALUES 
('Sala 101', 30, 'Bloco A', 'Disponível', 'Livre até 12:00'),
('Sala 204', 40, 'Bloco B', 'Ocupada', 'Ocupada'),
('Lab. 02', 24, 'Bloco C', 'Disponível', 'Livre o dia todo'),
('Auditório', 120, 'Bloco A', 'Disponível', 'Livre após 15:30'),
('Sala Maker', 20, 'Bloco C', 'Ocupada', 'Ocupada')

-- CreateTable
CREATE TABLE "Usuario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "ONG" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "instagram" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "atuaEmGrandeNatal" BOOLEAN NOT NULL,
    "trabalhaComCaes" BOOLEAN NOT NULL,
    "trabalhaComGatos" BOOLEAN NOT NULL,
    "trabalhaComOutros" BOOLEAN NOT NULL,
    "senha" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Pet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nome" TEXT NOT NULL,
    "foto" TEXT NOT NULL,
    "raca" TEXT NOT NULL,
    "sexo" TEXT NOT NULL,
    "especie" TEXT NOT NULL,
    "ongId" INTEGER NOT NULL,
    CONSTRAINT "Pet_ongId_fkey" FOREIGN KEY ("ongId") REFERENCES "ONG" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "ONG_email_key" ON "ONG"("email");

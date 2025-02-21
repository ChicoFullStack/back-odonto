-- CreateTable
CREATE TABLE "configuracoes" (
    "id" TEXT NOT NULL,
    "clinica" JSONB NOT NULL,
    "notificacoes" JSONB NOT NULL,
    "financeiro" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_pkey" PRIMARY KEY ("id")
);

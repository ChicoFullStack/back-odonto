-- CreateTable
CREATE TABLE "odontogramas" (
    "id" TEXT NOT NULL,
    "prontuarioId" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "odontogramas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "odontogramas_prontuarioId_key" ON "odontogramas"("prontuarioId");

-- AddForeignKey
ALTER TABLE "odontogramas" ADD CONSTRAINT "odontogramas_prontuarioId_fkey" FOREIGN KEY ("prontuarioId") REFERENCES "prontuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

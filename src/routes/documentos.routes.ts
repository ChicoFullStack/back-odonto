import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { ensureAuthenticated } from '../middlewares/ensureAuthenticated'
import { AppError } from '../errors/AppError'
import multer from 'multer'
import { uploadConfig } from '../config/upload'

const documentosRoutes = Router()
const upload = multer(uploadConfig)

documentosRoutes.use(ensureAuthenticated)

const documentoSchema = z.object({
  pacienteId: z.string().uuid(),
  nome: z.string(),
  tipo: z.string(),
})

// Listar documentos de um paciente
documentosRoutes.get('/paciente/:pacienteId', async (request, response) => {
  const { pacienteId } = request.params

  const documentos = await prisma.documento.findMany({
    where: { pacienteId },
    orderBy: { createdAt: 'desc' },
  })

  return response.json(documentos)
})

// Upload de documento
documentosRoutes.post(
  '/',
  upload.single('arquivo'),
  async (request, response) => {
    const { pacienteId, nome, tipo } = documentoSchema.parse(request.body)
    const arquivo = request.file

    if (!arquivo) {
      throw new AppError('Arquivo não enviado')
    }

    const documento = await prisma.documento.create({
      data: {
        pacienteId,
        nome,
        tipo,
        url: `/uploads/${arquivo.filename}`,
      },
    })

    return response.status(201).json(documento)
  }
)

// Excluir documento
documentosRoutes.delete('/:id', async (request, response) => {
  const { id } = request.params

  const documento = await prisma.documento.findUnique({
    where: { id },
  })

  if (!documento) {
    throw new AppError('Documento não encontrado', 404)
  }

  await prisma.documento.delete({
    where: { id },
  })

  return response.status(204).send()
})

export { documentosRoutes } 
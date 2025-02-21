import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { ensureAuthenticated } from '../middlewares/ensureAuthenticated'
import { AppError } from '../errors/AppError'

const prontuariosRoutes = Router()

prontuariosRoutes.use(ensureAuthenticated)

const prontuarioSchema = z.object({
  pacienteId: z.string().uuid(),
  descricao: z.string(),
  procedimento: z.string(),
  observacoes: z.string().optional().nullable(),
})

// Listar prontuários de um paciente
prontuariosRoutes.get('/paciente/:pacienteId', async (request, response) => {
  const { pacienteId } = request.params

  const prontuarios = await prisma.prontuario.findMany({
    where: { pacienteId },
    orderBy: { data: 'desc' },
  })

  return response.json(prontuarios)
})

// Buscar prontuário por ID
prontuariosRoutes.get('/:id', async (request, response) => {
  const { id } = request.params

  const prontuario = await prisma.prontuario.findUnique({
    where: { id },
    include: {
      paciente: true,
    },
  })

  if (!prontuario) {
    throw new AppError('Prontuário não encontrado', 404)
  }

  return response.json(prontuario)
})

// Criar prontuário
prontuariosRoutes.post('/', async (request, response) => {
  const data = prontuarioSchema.parse(request.body)

  const paciente = await prisma.paciente.findUnique({
    where: { id: data.pacienteId },
  })

  if (!paciente) {
    throw new AppError('Paciente não encontrado', 404)
  }

  const prontuario = await prisma.prontuario.create({
    data,
    include: {
      paciente: true,
    },
  })

  return response.status(201).json(prontuario)
})

// Atualizar prontuário
prontuariosRoutes.put('/:id', async (request, response) => {
  const { id } = request.params
  const data = prontuarioSchema.partial().parse(request.body)

  const prontuario = await prisma.prontuario.findUnique({
    where: { id },
  })

  if (!prontuario) {
    throw new AppError('Prontuário não encontrado', 404)
  }

  const prontuarioAtualizado = await prisma.prontuario.update({
    where: { id },
    data,
    include: {
      paciente: true,
    },
  })

  return response.json(prontuarioAtualizado)
})

// Excluir prontuário
prontuariosRoutes.delete('/:id', async (request, response) => {
  const { id } = request.params

  const prontuario = await prisma.prontuario.findUnique({
    where: { id },
    include: {
      odontograma: true
    }
  })

  if (!prontuario) {
    throw new AppError('Prontuário não encontrado', 404)
  }

  // Excluir o odontograma associado primeiro (se existir)
  if (prontuario.odontograma) {
    await prisma.odontograma.delete({
      where: { prontuarioId: id }
    })
  }

  // Excluir o prontuário
  await prisma.prontuario.delete({
    where: { id }
  })

  return response.status(204).send()
})

export { prontuariosRoutes } 
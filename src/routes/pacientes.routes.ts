import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { ensureAuthenticated } from '../middlewares/ensureAuthenticated'
import multer from 'multer'
import { uploadConfig } from '../config/upload'
import { AppError } from '../errors/AppError'

const pacientesRoutes = Router()
const upload = multer(uploadConfig)

pacientesRoutes.use(ensureAuthenticated)

const pacienteSchema = z.object({
  nome: z.string().min(3),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/),
  dataNascimento: z.string().transform(str => new Date(str)),
  genero: z.string().optional(),
  email: z.string().email().optional().nullable(),
  telefoneCelular: z.string(),
  telefoneFixo: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  contatoEmergenciaNome: z.string().optional().nullable(),
  contatoEmergenciaTelefone: z.string().optional().nullable(),
  contatoEmergenciaParentesco: z.string().optional().nullable(),
})

// Listar pacientes
pacientesRoutes.get('/', async (request, response) => {
  try {
    const { busca, page = 1, limit = 999 } = request.query // aumentei o limit para trazer todos

    const where = {
      AND: [
        { status: 'ativo' }, // Filtra apenas pacientes ativos
        busca ? {
          OR: [
            { nome: { contains: String(busca), mode: 'insensitive' } },
            { cpf: { contains: String(busca) } },
            { telefoneCelular: { contains: String(busca) } }
          ]
        } : {}
      ]
    }

    const [pacientes, total] = await Promise.all([
      prisma.paciente.findMany({
        where,
        orderBy: { nome: 'asc' },
        select: {
          id: true,
          nome: true,
          cpf: true,
          telefoneCelular: true,
          status: true
        }
      }),
      prisma.paciente.count({ where })
    ])

    return response.json({
      pacientes,
      total,
      pages: Math.ceil(total / Number(limit))
    })
  } catch (error) {
    console.error('Erro ao listar pacientes:', error)
    throw new AppError('Erro ao listar pacientes')
  }
})

// Buscar paciente por ID
pacientesRoutes.get('/:id', async (request, response) => {
  const { id } = request.params

  const paciente = await prisma.paciente.findUnique({
    where: { id },
    include: {
      historicoMedico: true,
      agendamentos: {
        include: {
          profissional: true,
        },
        orderBy: { data: 'desc' },
        take: 5,
      },
    },
  })

  if (!paciente) {
    throw new AppError('Paciente não encontrado', 404)
  }

  // Retornar apenas o caminho relativo do avatar
  return response.json(paciente)
})

// Criar paciente
pacientesRoutes.post('/', async (request, response) => {
  const data = pacienteSchema.parse(request.body)

  const pacienteExiste = await prisma.paciente.findFirst({
    where: { cpf: data.cpf },
  })

  if (pacienteExiste) {
    throw new AppError('CPF já cadastrado')
  }

  const paciente = await prisma.paciente.create({
    data,
  })

  return response.status(201).json(paciente)
})

// Atualizar paciente
pacientesRoutes.put('/:id', async (request, response) => {
  const { id } = request.params
  const data = pacienteSchema.partial().parse(request.body)

  const paciente = await prisma.paciente.findUnique({
    where: { id },
  })

  if (!paciente) {
    throw new AppError('Paciente não encontrado', 404)
  }

  if (data.cpf) {
    const pacienteComCpf = await prisma.paciente.findFirst({
      where: {
        cpf: data.cpf,
        NOT: { id },
      },
    })

    if (pacienteComCpf) {
      throw new AppError('CPF já cadastrado')
    }
  }

  const pacienteAtualizado = await prisma.paciente.update({
    where: { id },
    data,
  })

  return response.json(pacienteAtualizado)
})

// Upload de avatar
pacientesRoutes.patch(
  '/:id/avatar',
  upload.single('avatar'),
  async (request, response) => {
    const { id } = request.params
    const avatarFilename = request.file?.filename

    if (!avatarFilename) {
      throw new AppError('Arquivo não enviado')
    }

    // Salvar e retornar apenas o caminho relativo
    const avatarUrl = `/uploads/${avatarFilename}`

    const paciente = await prisma.paciente.update({
      where: { id },
      data: {
        avatarUrl,
      },
    })

    return response.json(paciente)
  }
)

// Atualizar status
pacientesRoutes.patch('/:id/status', async (request, response) => {
  const { id } = request.params
  const { status } = z.object({ status: z.enum(['ativo', 'inativo']) }).parse(request.body)

  const paciente = await prisma.paciente.update({
    where: { id },
    data: { status },
  })

  return response.json(paciente)
})

// Criar/Atualizar odontograma
pacientesRoutes.post('/:id/prontuario/:prontuarioId/odontograma', async (request, response) => {
  const { id, prontuarioId } = request.params
  const dados = request.body

  const paciente = await prisma.paciente.findUnique({
    where: { id },
  })

  if (!paciente) {
    throw new AppError('Paciente não encontrado', 404)
  }

  const prontuario = await prisma.prontuario.findUnique({
    where: { id: prontuarioId },
  })

  if (!prontuario) {
    throw new AppError('Prontuário não encontrado', 404)
  }

  const odontograma = await prisma.odontograma.upsert({
    where: {
      prontuarioId,
    },
    update: {
      dados,
    },
    create: {
      prontuarioId,
      dados,
    },
  })

  return response.json(odontograma)
})

// Buscar odontograma
pacientesRoutes.get('/:id/prontuario/:prontuarioId/odontograma', async (request, response) => {
  const { id, prontuarioId } = request.params

  const paciente = await prisma.paciente.findUnique({
    where: { id },
  })

  if (!paciente) {
    throw new AppError('Paciente não encontrado', 404)
  }

  const prontuario = await prisma.prontuario.findUnique({
    where: { id: prontuarioId },
    include: {
      odontograma: true,
    },
  })

  if (!prontuario) {
    throw new AppError('Prontuário não encontrado', 404)
  }

  return response.json(prontuario.odontograma)
})

// Rotas do Odontograma
pacientesRoutes.get('/:pacienteId/prontuario/:prontuarioId/odontograma', async (request, response) => {
  const { pacienteId, prontuarioId } = request.params

  const odontograma = await prisma.odontograma.findFirst({
    where: {
      prontuarioId,
      prontuario: {
        pacienteId
      }
    },
    include: {
      procedimentos: true
    }
  })

  if (!odontograma) {
    return response.json({ procedimentos: [] })
  }

  return response.json(odontograma)
})

pacientesRoutes.post('/:pacienteId/prontuario/:prontuarioId/odontograma', async (request, response) => {
  const { pacienteId, prontuarioId } = request.params
  const procedimentoData = request.body

  // Verificar se o prontuário existe e pertence ao paciente
  const prontuario = await prisma.prontuario.findFirst({
    where: {
      id: prontuarioId,
      pacienteId
    }
  })

  if (!prontuario) {
    throw new AppError('Prontuário não encontrado', 404)
  }

  // Buscar ou criar o odontograma
  let odontograma = await prisma.odontograma.findFirst({
    where: {
      prontuarioId
    }
  })

  if (!odontograma) {
    odontograma = await prisma.odontograma.create({
      data: {
        prontuarioId
      }
    })
  }

  // Criar o procedimento
  const procedimento = await prisma.procedimentoOdontograma.create({
    data: {
      ...procedimentoData,
      odontogramaId: odontograma.id
    }
  })

  return response.status(201).json(procedimento)
})

// Excluir paciente
pacientesRoutes.delete('/:id', async (request, response) => {
  const { id } = request.params

  const paciente = await prisma.paciente.findUnique({
    where: { id },
    include: {
      agendamentos: true,
      prontuarios: true,
    },
  })

  if (!paciente) {
    throw new AppError('Paciente não encontrado', 404)
  }

  // Verifica se existem registros vinculados
  if (paciente.agendamentos.length > 0 || paciente.prontuarios.length > 0) {
    throw new AppError('Não é possível excluir o paciente pois existem registros vinculados', 409)
  }

  await prisma.paciente.delete({
    where: { id },
  })

  return response.status(204).send()
})

export { pacientesRoutes } 
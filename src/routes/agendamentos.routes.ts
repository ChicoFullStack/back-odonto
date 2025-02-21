import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { ensureAuthenticated } from '../middlewares/ensureAuthenticated'
import { AppError } from '../errors/AppError'

const agendamentosRoutes = Router()

agendamentosRoutes.use(ensureAuthenticated)

// Mover a rota /hoje para antes das outras rotas
agendamentosRoutes.get('/hoje', async (request, response) => {
  try {
    const hoje = new Date()
    const inicioDia = new Date(hoje)
    inicioDia.setHours(0, 0, 0, 0)
    
    const fimDia = new Date(hoje)
    fimDia.setHours(23, 59, 59, 999)

    const agendamentos = await prisma.agendamento.findMany({
      where: {
        data: {
          gte: inicioDia,
          lte: fimDia
        }
      },
      orderBy: { 
        horaInicio: 'asc' 
      },
      include: {
        paciente: {
          select: {
            id: true,
            nome: true,
            telefoneCelular: true
          }
        },
        profissional: {
          select: {
            id: true,
            nome: true
          }
        }
      }
    })

    return response.json(agendamentos)
  } catch (error) {
    console.error('Erro ao buscar agendamentos do dia:', error)
    throw new AppError('Erro ao buscar agendamentos do dia')
  }
})

// Rota para buscar próximos agendamentos
agendamentosRoutes.get('/proximos', async (request, response) => {
  try {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)

    const agendamentos = await prisma.agendamento.findMany({
      where: {
        data: {
          gte: hoje
        },
        status: {
          not: 'cancelado'
        }
      },
      orderBy: [
        { data: 'asc' },
        { horaInicio: 'asc' }
      ],
      take: 10, // Limita a 10 agendamentos
      include: {
        paciente: {
          select: {
            id: true,
            nome: true,
            telefoneCelular: true
          }
        },
        profissional: {
          select: {
            id: true,
            nome: true
          }
        }
      }
    })

    return response.json(agendamentos)
  } catch (error) {
    console.error('Erro ao buscar próximos agendamentos:', error)
    throw new AppError('Erro ao buscar próximos agendamentos')
  }
})

const agendamentoSchema = z.object({
  pacienteId: z.string().uuid(),
  profissionalId: z.string().uuid(),
  data: z.string().transform(str => new Date(str)),
  horaInicio: z.string().transform(str => new Date(str)),
  horaFim: z.string().transform(str => new Date(str)),
  procedimento: z.string(),
  observacoes: z.string().optional().nullable(),
  status: z.enum(['agendado', 'confirmado', 'em_andamento', 'concluido', 'cancelado']).optional()
})

// Listar agendamentos
agendamentosRoutes.get('/', async (request, response) => {
  const { data, profissionalId, status, page = 1, limit = 10 } = request.query

  const where = {
    AND: [
      data ? {
        data: {
          gte: new Date(String(data)),
          lt: new Date(new Date(String(data)).setDate(new Date(String(data)).getDate() + 1)),
        },
      } : {},
      profissionalId ? { profissionalId: String(profissionalId) } : {},
      status ? { status: String(status) } : {},
    ],
  }

  const [agendamentos, total] = await Promise.all([
    prisma.agendamento.findMany({
      where,
      include: {
        paciente: true,
        profissional: true,
      },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      orderBy: [
        { data: 'asc' },
        { horaInicio: 'asc' },
      ],
    }),
    prisma.agendamento.count({ where }),
  ])

  return response.json({
    agendamentos,
    total,
    pages: Math.ceil(total / Number(limit)),
  })
})

// Buscar agendamento por ID
agendamentosRoutes.get('/:id', async (request, response) => {
  const { id } = request.params

  const agendamento = await prisma.agendamento.findUnique({
    where: { id },
    include: {
      paciente: true,
      profissional: true,
    },
  })

  if (!agendamento) {
    throw new AppError('Agendamento não encontrado', 404)
  }

  return response.json(agendamento)
})

// Criar agendamento
agendamentosRoutes.post('/', async (request, response) => {
  const data = agendamentoSchema.parse(request.body)

  // Verificar se o horário está disponível
  const conflito = await prisma.agendamento.findFirst({
    where: {
      profissionalId: data.profissionalId,
      data: data.data,
      NOT: {
        status: 'cancelado',
      },
      OR: [
        {
          AND: [
            { horaInicio: { lte: data.horaInicio } },
            { horaFim: { gt: data.horaInicio } },
          ],
        },
        {
          AND: [
            { horaInicio: { lt: data.horaFim } },
            { horaFim: { gte: data.horaFim } },
          ],
        },
      ],
    },
  })

  if (conflito) {
    throw new AppError('Horário não disponível')
  }

  const agendamento = await prisma.agendamento.create({
    data,
    include: {
      paciente: true,
      profissional: true,
    },
  })

  return response.status(201).json(agendamento)
})

// Atualizar agendamento
agendamentosRoutes.put('/:id', async (request, response) => {
  const { id } = request.params
  
  // Log dos dados recebidos
  console.log('Dados recebidos:', request.body)
  
  const data = agendamentoSchema.partial().parse(request.body)
  
  // Log dos dados após parse
  console.log('Dados após parse:', data)

  const agendamento = await prisma.agendamento.findUnique({
    where: { id },
  })

  if (!agendamento) {
    throw new AppError('Agendamento não encontrado', 404)
  }

  if (data.horaInicio || data.horaFim || data.data || data.profissionalId) {
    const dataVerificar = data.data || agendamento.data
    const horaInicioVerificar = data.horaInicio || agendamento.horaInicio
    const horaFimVerificar = data.horaFim || agendamento.horaFim
    const profissionalIdVerificar = data.profissionalId || agendamento.profissionalId

    // Ajustar para o mesmo dia
    const dataInicio = new Date(dataVerificar)
    dataInicio.setHours(0, 0, 0, 0)
    
    const dataFim = new Date(dataVerificar)
    dataFim.setHours(23, 59, 59, 999)

    const conflito = await prisma.agendamento.findFirst({
      where: {
        id: { not: id },
        profissionalId: profissionalIdVerificar,
        status: { not: 'cancelado' },
        data: {
          gte: dataInicio,
          lte: dataFim
        },
        OR: [
          {
            AND: [
              { horaInicio: { lte: horaInicioVerificar } },
              { horaFim: { gt: horaInicioVerificar } }
            ]
          },
          {
            AND: [
              { horaInicio: { lt: horaFimVerificar } },
              { horaFim: { gte: horaFimVerificar } }
            ]
          }
        ]
      }
    })

    if (conflito) {
      throw new AppError('Horário não disponível')
    }
  }

  // Log dos dados antes da atualização
  console.log('Dados para atualização:', data)

  const agendamentoAtualizado = await prisma.agendamento.update({
    where: { id },
    data,
    include: {
      paciente: true,
      profissional: true,
    },
  })

  // Log do resultado
  console.log('Agendamento atualizado:', agendamentoAtualizado)

  return response.json(agendamentoAtualizado)
})

// Atualizar status
agendamentosRoutes.patch('/:id/status', async (request, response) => {
  const { id } = request.params
  const { status } = z.object({
    status: z.enum(['agendado', 'confirmado', 'em_andamento', 'concluido', 'cancelado']),
  }).parse(request.body)

  const agendamento = await prisma.agendamento.update({
    where: { id },
    data: { status },
    include: {
      paciente: true,
      profissional: true,
    },
  })

  return response.json(agendamento)
})

// Excluir agendamento
agendamentosRoutes.delete('/:id', async (request, response) => {
  const { id } = request.params

  const agendamento = await prisma.agendamento.findUnique({
    where: { id }
  })

  if (!agendamento) {
    throw new AppError('Agendamento não encontrado', 404)
  }

  // Não permite excluir agendamentos concluídos
  if (agendamento.status === 'concluido') {
    throw new AppError('Não é possível excluir um agendamento concluído', 400)
  }

  await prisma.agendamento.delete({
    where: { id }
  })

  return response.status(204).send()
})

export { agendamentosRoutes } 
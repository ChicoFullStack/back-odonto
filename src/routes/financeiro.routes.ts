import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { ensureAuthenticated } from '../middlewares/ensureAuthenticated'
import { z } from 'zod'
import { AppError } from '../errors/AppError'

const financeiroRoutes = Router()

financeiroRoutes.use(ensureAuthenticated)

// Schema de validação
const lancamentoSchema = z.object({
  tipo: z.enum(['receita', 'despesa']),
  categoria: z.string().min(1),
  descricao: z.string().min(1),
  valor: z.number().positive(),
  data: z.string().or(z.date()), // Aceita string ou Date
  status: z.enum(['pendente', 'pago', 'cancelado']),
  formaPagamento: z.string().min(1),
  pacienteId: z.string().nullable().optional()
})

// Criar lançamento
financeiroRoutes.post('/', async (request, response) => {
  try {
    const data = lancamentoSchema.parse(request.body)

    const lancamento = await prisma.lancamentoFinanceiro.create({
      data: {
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    })

    return response.status(201).json(lancamento)
  } catch (error) {
    console.error('Erro ao criar lançamento:', error)
    if (error instanceof z.ZodError) {
      throw new AppError('Dados inválidos: ' + error.errors.map(e => e.message).join(', '))
    }
    throw new AppError('Erro ao criar lançamento financeiro')
  }
})

// Listar lançamentos
financeiroRoutes.get('/', async (request, response) => {
  try {
    const { busca, tipo, status, dataInicio, dataFim, page = 1, limit = 10 } = request.query

    // Construir where com os filtros
    const where: any = {}

    if (busca) {
      where.OR = [
        { descricao: { contains: String(busca), mode: 'insensitive' } },
        { categoria: { contains: String(busca), mode: 'insensitive' } },
      ]
    }

    if (tipo) {
      where.tipo = String(tipo)
    }

    if (status) {
      where.status = String(status)
    }

    if (dataInicio || dataFim) {
      where.data = {}
      if (dataInicio) where.data.gte = new Date(String(dataInicio))
      if (dataFim) where.data.lte = new Date(String(dataFim))
    }

    const [lancamentos, total] = await Promise.all([
      prisma.lancamentoFinanceiro.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { data: 'desc' },
        include: {
          paciente: {
            select: {
              id: true,
              nome: true,
              cpf: true
            }
          }
        }
      }),
      prisma.lancamentoFinanceiro.count({ where })
    ])

    return response.json({
      lancamentos,
      total,
      pages: Math.ceil(total / Number(limit))
    })
  } catch (error) {
    console.error('Erro ao listar lançamentos:', error)
    throw new AppError('Erro ao listar lançamentos financeiros')
  }
})

// Buscar lançamento por ID
financeiroRoutes.get('/:id', async (request, response) => {
  const { id } = request.params

  const lancamento = await prisma.lancamentoFinanceiro.findUnique({
    where: { id },
    include: {
      paciente: {
        select: {
          id: true,
          nome: true,
          cpf: true
        }
      }
    }
  })

  if (!lancamento) {
    throw new AppError('Lançamento não encontrado', 404)
  }

  return response.json(lancamento)
})

// Atualizar lançamento
financeiroRoutes.put('/:id', async (request, response) => {
  const { id } = request.params
  const data = lancamentoSchema.parse(request.body)

  const lancamento = await prisma.lancamentoFinanceiro.findUnique({
    where: { id }
  })

  if (!lancamento) {
    throw new AppError('Lançamento não encontrado', 404)
  }

  const lancamentoAtualizado = await prisma.lancamentoFinanceiro.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date()
    }
  })

  return response.json(lancamentoAtualizado)
})

// Excluir lançamento
financeiroRoutes.delete('/:id', async (request, response) => {
  const { id } = request.params

  const lancamento = await prisma.lancamentoFinanceiro.findUnique({
    where: { id }
  })

  if (!lancamento) {
    throw new AppError('Lançamento não encontrado', 404)
  }

  await prisma.lancamentoFinanceiro.delete({
    where: { id }
  })

  return response.status(204).send()
})

export { financeiroRoutes } 
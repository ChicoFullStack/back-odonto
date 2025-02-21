import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { ensureAuthenticated } from '../middlewares/ensureAuthenticated'
import { z } from 'zod'
import { AppError } from '../errors/AppError'

const configuracoesRoutes = Router()

configuracoesRoutes.use(ensureAuthenticated)

const configSchema = z.object({
  clinica: z.object({
    nome: z.string().min(3),
    cnpj: z.string(),
    telefone: z.string(),
    email: z.string().email(),
    endereco: z.object({
      cep: z.string(),
      logradouro: z.string(),
      numero: z.string(),
      complemento: z.string().optional(),
      bairro: z.string(),
      cidade: z.string(),
      estado: z.string().length(2)
    })
  }),
  notificacoes: z.object({
    emailAgendamento: z.boolean(),
    emailLembrete: z.boolean(),
    whatsappLembrete: z.boolean()
  }),
  financeiro: z.object({
    diasVencimento: z.number().min(1).max(90),
    lembreteAntecedencia: z.number().min(1).max(30)
  })
})

// Buscar configurações
configuracoesRoutes.get('/', async (request, response) => {
  try {
    const config = await prisma.configuracao.findFirst()
    return response.json(config)
  } catch (error) {
    console.error('Erro ao buscar configurações:', error)
    throw new AppError('Erro ao buscar configurações')
  }
})

// Atualizar configurações
configuracoesRoutes.put('/', async (request, response) => {
  try {
    const data = configSchema.parse(request.body)

    // Converte os valores numéricos do financeiro
    const financeiro = {
      ...data.financeiro,
      diasVencimento: Number(data.financeiro.diasVencimento),
      lembreteAntecedencia: Number(data.financeiro.lembreteAntecedencia)
    }

    const config = await prisma.configuracao.upsert({
      where: { 
        id: '1' 
      },
      update: {
        clinica: data.clinica,
        notificacoes: data.notificacoes,
        financeiro: financeiro
      },
      create: {
        id: '1',
        clinica: data.clinica,
        notificacoes: data.notificacoes,
        financeiro: financeiro
      }
    })

    return response.json(config)
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error)
    if (error instanceof z.ZodError) {
      throw new AppError('Dados inválidos: ' + error.errors.map(e => e.message).join(', '))
    }
    throw new AppError('Erro ao atualizar configurações')
  }
})

export { configuracoesRoutes } 
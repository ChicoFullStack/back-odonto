import { Router } from 'express'
import { prisma } from '../lib/prisma'
import { ensureAuthenticated } from '../middlewares/ensureAuthenticated'
import { AppError } from '../errors/AppError'

const dashboardRoutes = Router()

dashboardRoutes.use(ensureAuthenticated)

dashboardRoutes.get('/', async (request, response) => {
  try {
    const hoje = new Date()
    const primeiroDiaMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    const ultimoDiaMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)

    // Início e fim do dia atual
    const inicioDia = new Date()
    inicioDia.setHours(0, 0, 0, 0)
    
    const fimDia = new Date()
    fimDia.setHours(23, 59, 59, 999)

    // Receitas do dia
    const receitasDia = await prisma.lancamentoFinanceiro.aggregate({
      where: {
        tipo: 'receita',
        data: {
          gte: inicioDia,
          lte: fimDia
        }
      },
      _sum: { valor: true },
      _count: true
    })

    // Totais do mês atual
    const [receitasMes, despesasMes] = await Promise.all([
      prisma.lancamentoFinanceiro.aggregate({
        where: {
          tipo: 'receita',
          data: {
            gte: primeiroDiaMes,
            lte: ultimoDiaMes
          }
        },
        _sum: { valor: true },
        _count: true
      }),
      prisma.lancamentoFinanceiro.aggregate({
        where: {
          tipo: 'despesa',
          data: {
            gte: primeiroDiaMes,
            lte: ultimoDiaMes
          }
        },
        _sum: { valor: true },
        _count: true
      })
    ])

    // Próximos agendamentos
    const proximosAgendamentos = await prisma.agendamento.findMany({
      where: {
        data: {
          gte: hoje
        },
        status: {
          notIn: ['cancelado', 'concluido']
        }
      },
      take: 5,
      orderBy: { data: 'asc' },
      include: {
        paciente: {
          select: {
            nome: true
          }
        },
        profissional: {
          select: {
            nome: true
          }
        }
      }
    })

    // Contagem de pacientes ativos
    const totalPacientes = await prisma.paciente.count({
      where: {
        status: 'ativo'
      }
    })

    // Lançamentos pendentes
    const lancamentosPendentes = await prisma.lancamentoFinanceiro.count({
      where: {
        status: 'pendente'
      }
    })

    return response.json({
      financeiro: {
        receitasMes: {
          total: receitasMes._sum.valor || 0,
          quantidade: receitasMes._count
        },
        despesasMes: {
          total: despesasMes._sum.valor || 0,
          quantidade: despesasMes._count
        },
        receitasDia: {
          total: receitasDia._sum.valor || 0,
          quantidade: receitasDia._count
        },
        saldoMes: (receitasMes._sum.valor || 0) - (despesasMes._sum.valor || 0),
        lancamentosPendentes
      },
      proximosAgendamentos,
      totalPacientes
    })
  } catch (error) {
    console.error('Erro ao carregar dados do dashboard:', error)
    throw new AppError('Erro ao carregar dados do dashboard')
  }
})

export { dashboardRoutes } 
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { ensureAuthenticated } from '../middlewares/ensureAuthenticated'
import multer from 'multer'
import { uploadConfig } from '../config/upload'
import { AppError } from '../errors/AppError'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'

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
            { nome: { contains: String(busca), mode: 'insensitive' as const } },
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

interface Procedimento {
  id?: string;
  dente: string;
  face?: string;
  tipo: string;
  observacao?: string;
  data: string;
}

interface OdontogramaDados {
  procedimentos: Procedimento[];
}

// Função para converter array de JSON para array de Procedimento
function convertToProcedimentos(arr: unknown): Procedimento[] {
  if (!Array.isArray(arr)) return [];
  return arr.filter((item): item is Procedimento => {
    if (!item || typeof item !== 'object') return false;
    const p = item as any;
    return (
      typeof p.dente === 'string' &&
      typeof p.tipo === 'string' &&
      (!p.face || typeof p.face === 'string') &&
      (!p.observacao || typeof p.observacao === 'string') &&
      (!p.id || typeof p.id === 'string') &&
      (!p.data || typeof p.data === 'string')
    );
  });
}

// Função para converter dados para formato JSON do Prisma
function convertToJsonData(dados: OdontogramaDados): Prisma.InputJsonValue {
  return {
    procedimentos: dados.procedimentos.map(proc => ({
      id: proc.id || null,
      dente: proc.dente,
      face: proc.face || null,
      tipo: proc.tipo,
      observacao: proc.observacao || null,
      data: proc.data
    }))
  };
}

// Rotas do Odontograma
pacientesRoutes.get('/:pacienteId/prontuario/:prontuarioId/odontograma', async (request, response) => {
  const { pacienteId, prontuarioId } = request.params

  const odontograma = await prisma.odontograma.findFirst({
    where: {
      prontuarioId,
      prontuario: {
        pacienteId: pacienteId
      }
    }
  })

  if (!odontograma) {
    const dadosVazios: OdontogramaDados = { procedimentos: [] };
    return response.json({ 
      id: null,
      prontuarioId,
      dados: convertToJsonData(dadosVazios),
      createdAt: new Date(),
      updatedAt: new Date()
    })
  }

  const dados = odontograma.dados as unknown;
  const procedimentosRaw = Array.isArray(dados) ? dados : (dados as any)?.procedimentos;
  const procedimentos = convertToProcedimentos(procedimentosRaw);
  
  return response.json({
    ...odontograma,
    dados: convertToJsonData({ procedimentos })
  })
})

pacientesRoutes.post('/:pacienteId/prontuario/:prontuarioId/odontograma', async (request, response) => {
  const { pacienteId, prontuarioId } = request.params
  
  // Validar o procedimento recebido
  const procedimentos = convertToProcedimentos([request.body]);
  if (procedimentos.length === 0) {
    throw new AppError('Dados do procedimento inválidos', 400)
  }
  const procedimentoData = procedimentos[0];

  // Verificar se o prontuário existe e pertence ao paciente
  const prontuario = await prisma.prontuario.findFirst({
    where: {
      id: prontuarioId,
      pacienteId: pacienteId
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

  const dadosIniciais: OdontogramaDados = {
    procedimentos: []
  }

  if (!odontograma) {
    odontograma = await prisma.odontograma.create({
      data: {
        prontuarioId,
        dados: convertToJsonData(dadosIniciais)
      }
    })
  }

  // Atualizar o odontograma com o novo procedimento
  const dadosAtuais = odontograma.dados as Record<string, unknown>
  const procedimentosRaw = dadosAtuais?.procedimentos as unknown
  const procedimentosAtuais = convertToProcedimentos(procedimentosRaw)
  
  const dadosAtualizados: OdontogramaDados = {
    procedimentos: [
      ...procedimentosAtuais,
      {
        ...procedimentoData,
        id: randomUUID(),
        data: new Date().toISOString()
      }
    ]
  }

  const procedimento = await prisma.odontograma.update({
    where: {
      id: odontograma.id
    },
    data: {
      dados: convertToJsonData(dadosAtualizados)
    }
  })

  const dadosFinais = procedimento.dados as Record<string, unknown>
  const procedimentosFinaisRaw = dadosFinais?.procedimentos as unknown
  const procedimentosFinais = convertToProcedimentos(procedimentosFinaisRaw)

  return response.json({
    ...procedimento,
    dados: convertToJsonData({ procedimentos: procedimentosFinais })
  })
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
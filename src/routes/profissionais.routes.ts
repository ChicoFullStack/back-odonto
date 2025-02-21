import { Router } from 'express'
import { z } from 'zod'
import { ensureAuthenticated } from '../middlewares/ensureAuthenticated'
import multer from 'multer'
import { AppError } from '../errors/AppError'
import { prisma } from '../lib/prisma'
import path from 'path'
import fs from 'fs'
import { Especialidade } from '@prisma/client'

// Configuração do multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = './uploads'
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`
    cb(null, `avatar-${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const profissionaisRoutes = Router()

const uploadAvatar = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png']
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Tipo de arquivo inválido.'))
    }
  }
})

profissionaisRoutes.use(ensureAuthenticated)

const profissionalSchema = z.object({
  nome: z.string().min(3),
  email: z.string().email(),
  telefone: z.string(),
  cro: z.string(),
  especialidade: z.nativeEnum(Especialidade),
  dataNascimento: z.string().transform(str => new Date(str)),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/),
  rg: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  estado: z.string().optional().nullable(),
  cep: z.string().optional().nullable(),
})

// Rota para listar todos os profissionais (para selects/combos)
profissionaisRoutes.get('/lista', async (request, response) => {
  try {
    console.log('Buscando lista de profissionais')
    const profissionais = await prisma.profissional.findMany({
      select: {
        id: true,
        nome: true,
        status: true
      },
      orderBy: {
        nome: 'asc'
      }
    })

    console.log('Profissionais encontrados:', profissionais)
    return response.json(profissionais)
  } catch (error) {
    console.error('Erro ao listar profissionais:', error)
    throw new AppError('Erro ao listar profissionais')
  }
})

// Rota principal com paginação (manter como está)
profissionaisRoutes.get('/', async (request, response) => {
  try {
    const { busca, especialidade, page = 1, limit = 10 } = request.query

    const where = {
      AND: [
        busca ? {
          OR: [
            { nome: { contains: String(busca), mode: 'insensitive' as const } },
            { cro: { contains: String(busca) } },
            { email: { contains: String(busca), mode: 'insensitive' as const } }
          ]
        } : {},
        especialidade ? {
          especialidade: especialidade as Especialidade
        } : {}
      ]
    }

    const [profissionais, total] = await Promise.all([
      prisma.profissional.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { nome: 'asc' },
      }),
      prisma.profissional.count({ where }),
    ])

    return response.json({
      profissionais,
      total,
      pages: Math.ceil(total / Number(limit)),
    })
  } catch (error) {
    console.error('Erro ao listar profissionais:', error)
    throw new AppError('Erro ao listar profissionais')
  }
})

// Buscar profissional por ID
profissionaisRoutes.get('/:id', async (request, response) => {
  const { id } = request.params

  const profissional = await prisma.profissional.findUnique({
    where: { id },
  })

  if (!profissional) {
    throw new AppError('Profissional não encontrado', 404)
  }

  return response.json(profissional)
})

// Criar profissional
profissionaisRoutes.post('/', async (request, response) => {
  const data = profissionalSchema.parse(request.body)

  const profissionalExiste = await prisma.profissional.findFirst({
    where: {
      OR: [
        { cro: data.cro },
        { cpf: data.cpf },
        { email: data.email },
      ],
    },
  })

  if (profissionalExiste) {
    throw new AppError('Já existe um profissional com este CRO, CPF ou e-mail')
  }

  const profissional = await prisma.profissional.create({
    data: {
      ...data,
      status: 'ativo',
    },
  })

  return response.status(201).json(profissional)
})

// Atualizar profissional
profissionaisRoutes.put('/:id', async (request, response) => {
  const { id } = request.params
  const data = profissionalSchema.partial().parse(request.body)

  const profissional = await prisma.profissional.findUnique({
    where: { id },
  })

  if (!profissional) {
    throw new AppError('Profissional não encontrado', 404)
  }

  if (data.cro || data.cpf || data.email) {
    const profissionalExiste = await prisma.profissional.findFirst({
      where: {
        OR: [
          data.cro ? { cro: data.cro } : {},
          data.cpf ? { cpf: data.cpf } : {},
          data.email ? { email: data.email } : {},
        ],
        NOT: { id },
      },
    })

    if (profissionalExiste) {
      throw new AppError('Já existe um profissional com este CRO, CPF ou e-mail')
    }
  }

  const profissionalAtualizado = await prisma.profissional.update({
    where: { id },
    data,
  })

  return response.json(profissionalAtualizado)
})

// Upload de avatar
profissionaisRoutes.patch(
  '/:id/avatar',
  uploadAvatar.single('avatar'),
  async (request, response) => {
    try {
      const { id } = request.params
      const avatarFilename = request.file?.filename

      if (!avatarFilename) {
        throw new AppError('Arquivo não enviado')
      }

      // Busca o profissional para verificar se existe um avatar anterior
      const profissional = await prisma.profissional.findUnique({
        where: { id },
        select: { avatarUrl: true }
      })

      if (!profissional) {
        throw new AppError('Profissional não encontrado', 404)
      }

      // Remove o avatar anterior se existir
      if (profissional.avatarUrl) {
        const oldAvatarPath = path.join(
          __dirname, 
          '..', 
          '..', 
          profissional.avatarUrl.replace(/^\/uploads\//, '')
        )
        
        try {
          await fs.promises.unlink(oldAvatarPath)
        } catch (error) {
          console.error('Erro ao remover avatar anterior:', error)
        }
      }

      // Atualiza o profissional com a nova URL do avatar
      const avatarUrl = `/uploads/${avatarFilename}`
      
      const updatedProfissional = await prisma.profissional.update({
        where: { id },
        data: { avatarUrl }
      })

      return response.json(updatedProfissional)
    } catch (error) {
      // Remove o arquivo enviado em caso de erro
      if (request.file) {
        const filePath = path.join(__dirname, '..', '..', 'uploads', request.file.filename)
        try {
          await fs.promises.unlink(filePath)
        } catch (error) {
          console.error('Erro ao remover arquivo:', error)
        }
      }

      if (error instanceof Error) {
        throw new AppError(error.message)
      }
      throw error
    }
  }
)

// Remover avatar
profissionaisRoutes.delete('/:id/avatar', async (request, response) => {
  try {
    const { id } = request.params

    const profissional = await prisma.profissional.findUnique({
      where: { id },
      select: { avatarUrl: true }
    })

    if (!profissional) {
      throw new AppError('Profissional não encontrado', 404)
    }

    if (profissional.avatarUrl) {
      const avatarPath = path.join(
        __dirname, 
        '..', 
        '..', 
        profissional.avatarUrl.replace(/^\/uploads\//, '')
      )
      
      try {
        await fs.promises.unlink(avatarPath)
      } catch (error) {
        console.error('Erro ao remover arquivo:', error)
      }
    }

    await prisma.profissional.update({
      where: { id },
      data: { avatarUrl: null }
    })

    return response.status(204).send()
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError(error.message)
    }
    throw error
  }
})

// Atualizar status
profissionaisRoutes.patch('/:id/status', async (request, response) => {
  const { id } = request.params
  const { status } = z.object({ status: z.enum(['ativo', 'inativo']) }).parse(request.body)

  const profissional = await prisma.profissional.update({
    where: { id },
    data: { status },
  })

  return response.json(profissional)
})

// Excluir profissional
profissionaisRoutes.delete('/:id', async (request, response) => {
  const { id } = request.params

  const profissional = await prisma.profissional.findUnique({
    where: { id },
    include: {
      agendamentos: true,
    },
  })

  if (!profissional) {
    throw new AppError('Profissional não encontrado', 404)
  }

  // Verifica se existem agendamentos vinculados
  if (profissional.agendamentos.length > 0) {
    throw new AppError('Não é possível excluir o profissional pois existem agendamentos vinculados', 409)
  }

  await prisma.profissional.delete({
    where: { id },
  })

  return response.status(204).send()
})

export { profissionaisRoutes } 
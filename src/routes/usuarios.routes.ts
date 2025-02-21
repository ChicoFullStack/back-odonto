import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { hash } from 'bcryptjs'
import { ensureAuthenticated } from '../middlewares/ensureAuthenticated'
import { AppError } from '../errors/AppError'

const usuariosRoutes = Router()

const usuarioSchema = z.object({
  nome: z.string().min(3),
  email: z.string().email(),
  senha: z.string().min(6),
  cargo: z.string(),
})

const createAdminSchema = z.object({
  nome: z.string().min(3),
  email: z.string().email(),
  senha: z.string().min(6),
  cargo: z.enum(['admin']),
})

// Rota pública para criar o primeiro admin (deve ser removida após criar o primeiro admin)
usuariosRoutes.post('/criar-admin', async (request, response) => {
  try {
    // Verificar se já existe algum usuário
    const usuariosExistentes = await prisma.usuario.count()
    
    if (usuariosExistentes > 0) {
      throw new AppError('Já existe um usuário administrador', 400)
    }

    const { nome, email, senha } = usuarioSchema.parse({
      nome: 'Administrador',
      email: request.body.email,
      senha: request.body.senha,
      cargo: 'admin'
    })

    const senhaHash = await hash(senha, 8)

    const admin = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash,
        cargo: 'admin'
      },
      select: {
        id: true,
        nome: true,
        email: true,
        cargo: true,
        createdAt: true,
      },
    })

    return response.status(201).json(admin)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return response.status(400).json({
        message: 'Dados inválidos',
        errors: error.errors
      })
    }
    throw error
  }
})

// Rota temporária para verificar usuários (REMOVER APÓS USO!)
usuariosRoutes.get('/verificar', async (request, response) => {
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true,
      nome: true,
      email: true,
      cargo: true,
      createdAt: true
    }
  })
  return response.json(usuarios)
})

// Rota temporária para redefinir senha do admin (REMOVER APÓS USO!)
usuariosRoutes.post('/redefinir-senha-admin', async (request, response) => {
  const { senha } = request.body
  
  if (!senha || senha.length < 6) {
    throw new AppError('Senha inválida. Mínimo de 6 caracteres.')
  }

  const admin = await prisma.usuario.findFirst({
    where: {
      cargo: 'Administrador'
    }
  })

  if (!admin) {
    throw new AppError('Administrador não encontrado')
  }

  const senhaHash = await hash(senha, 8)

  await prisma.usuario.update({
    where: { id: admin.id },
    data: { senha: senhaHash }
  })

  return response.json({ message: 'Senha redefinida com sucesso' })
})

// Aplicar middleware de autenticação nas demais rotas
usuariosRoutes.use(ensureAuthenticated)

// Listar usuários
usuariosRoutes.get('/', async (request, response) => {
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true,
      nome: true,
      email: true,
      cargo: true,
      createdAt: true,
    },
  })

  return response.json(usuarios)
})

// Buscar usuário por ID
usuariosRoutes.get('/:id', async (request, response) => {
  const { id } = request.params

  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: {
      id: true,
      nome: true,
      email: true,
      cargo: true,
      createdAt: true,
    },
  })

  if (!usuario) {
    throw new AppError('Usuário não encontrado', 404)
  }

  return response.json(usuario)
})

// Criar usuário
usuariosRoutes.post('/', async (request, response) => {
  const data = usuarioSchema.parse(request.body)

  const usuarioExiste = await prisma.usuario.findUnique({
    where: { email: data.email },
  })

  if (usuarioExiste) {
    throw new AppError('Email já cadastrado')
  }

  const senhaHash = await hash(data.senha, 8)

  const usuario = await prisma.usuario.create({
    data: {
      ...data,
      senha: senhaHash,
    },
    select: {
      id: true,
      nome: true,
      email: true,
      cargo: true,
      createdAt: true,
    },
  })

  return response.status(201).json(usuario)
})

// Atualizar usuário
usuariosRoutes.put('/:id', async (request, response) => {
  const { id } = request.params
  const data = usuarioSchema.partial().parse(request.body)

  const usuario = await prisma.usuario.findUnique({
    where: { id },
  })

  if (!usuario) {
    throw new AppError('Usuário não encontrado', 404)
  }

  if (data.email) {
    const usuarioComEmail = await prisma.usuario.findFirst({
      where: {
        email: data.email,
        NOT: { id },
      },
    })

    if (usuarioComEmail) {
      throw new AppError('Email já cadastrado')
    }
  }

  let senhaHash = undefined
  if (data.senha) {
    senhaHash = await hash(data.senha, 8)
  }

  const usuarioAtualizado = await prisma.usuario.update({
    where: { id },
    data: {
      ...data,
      senha: senhaHash,
    },
    select: {
      id: true,
      nome: true,
      email: true,
      cargo: true,
      createdAt: true,
    },
  })

  return response.json(usuarioAtualizado)
})

// Excluir usuário
usuariosRoutes.delete('/:id', async (request, response) => {
  const { id } = request.params

  const usuario = await prisma.usuario.findUnique({
    where: { id },
  })

  if (!usuario) {
    throw new AppError('Usuário não encontrado', 404)
  }

  await prisma.usuario.delete({
    where: { id },
  })

  return response.status(204).send()
})

// Rota para criar usuário admin
usuariosRoutes.post('/admin', async (request, response) => {
  try {
    const { nome, email, senha, cargo } = createAdminSchema.parse(request.body)

    // Verifica se já existe um usuário com este email
    const userExists = await prisma.usuario.findUnique({
      where: { email }
    })

    if (userExists) {
      throw new AppError('Email já cadastrado')
    }

    // Criptografa a senha
    const hashedPassword = await hash(senha, 8)

    // Cria o usuário admin
    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: hashedPassword,
        cargo
      }
    })

    // Remove a senha do retorno
    const { senha: _, ...usuarioSemSenha } = usuario

    return response.status(201).json(usuarioSemSenha)
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError('Dados inválidos: ' + error.errors[0].message)
    }
    throw error
  }
})

export { usuariosRoutes } 
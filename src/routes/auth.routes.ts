import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { compare } from 'bcryptjs'
import { sign } from 'jsonwebtoken'
import { AppError } from '../errors/AppError'

const authRoutes = Router()

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6),
})

authRoutes.post('/login', async (request, response) => {
  const { email, senha } = loginSchema.parse(request.body)

  const usuario = await prisma.usuario.findUnique({
    where: { email },
  })

  if (!usuario) {
    throw new AppError('Email ou senha incorretos', 401)
  }

  const senhaCorreta = await compare(senha, usuario.senha)

  if (!senhaCorreta) {
    throw new AppError('Email ou senha incorretos', 401)
  }

  const token = sign(
    { nome: usuario.nome },
    process.env.JWT_SECRET || 'default',
    {
      subject: usuario.id,
      expiresIn: '1d'
    }
  )

  return response.json({
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      cargo: usuario.cargo,
    },
    token,
  })
})

export { authRoutes } 
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    const email = 'admin@exemplo.com' // altere conforme necessário
    
    const userExists = await prisma.usuario.findUnique({
      where: { email }
    })

    if (userExists) {
      console.log('Usuário admin já existe')
      return
    }

    const hashedPassword = await hash('123456', 8)

    const admin = await prisma.usuario.create({
      data: {
        nome: 'Admin',
        email,
        senha: hashedPassword,
        cargo: 'admin'
      }
    })

    console.log('Usuário admin criado com sucesso:', admin)
  } catch (error) {
    console.error('Erro ao criar usuário admin:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin() 
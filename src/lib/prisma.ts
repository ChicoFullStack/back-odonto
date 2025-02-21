import { PrismaClient } from '@prisma/client'

declare global {
  var prisma: PrismaClient | undefined
}

const prismaClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

prismaClient.$connect()
  .then(() => console.log('Database connected successfully'))
  .catch((error) => console.error('Database connection error:', error))

export const prisma = global.prisma || prismaClient

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
} 
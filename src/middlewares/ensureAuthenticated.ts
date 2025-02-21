import { Request, Response, NextFunction } from 'express'
import { verify } from 'jsonwebtoken'
import { AppError } from '../errors/AppError'

interface ITokenPayload {
  sub: string
}

export function ensureAuthenticated(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const authHeader = request.headers.authorization

  if (!authHeader) {
    throw new AppError('JWT token is missing', 401)
  }

  const [, token] = authHeader.split(' ')

  try {
    const decoded = verify(token, process.env.JWT_SECRET as string)
    const { sub } = decoded as ITokenPayload

    request.user = {
      id: sub,
    }

    return next()
  } catch {
    throw new AppError('Invalid JWT token', 401)
  }
} 
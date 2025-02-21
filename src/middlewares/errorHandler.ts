import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '../errors/AppError'

export function errorHandler(
  error: Error,
  request: Request,
  response: Response,
  next: NextFunction
) {
  if (error instanceof AppError) {
    return response.status(error.statusCode).json({
      status: 'error',
      message: error.message,
    })
  }

  if (error instanceof ZodError) {
    return response.status(400).json({
      status: 'error',
      message: 'Validation error',
      errors: error.errors,
    })
  }

  console.error(error)

  return response.status(500).json({
    status: 'error',
    message: 'Internal server error',
  })
} 
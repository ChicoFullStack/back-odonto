import { Router } from 'express'
import multer from 'multer'
import { uploadConfig } from '../config/upload'
import { ensureAuthenticated } from '../middlewares/ensureAuthenticated'
import { AppError } from '../errors/AppError'

const uploadsRoutes = Router()
const upload = multer(uploadConfig)

uploadsRoutes.use(ensureAuthenticated)

// Upload temporário
uploadsRoutes.post('/temp', upload.single('avatar'), async (request, response) => {
  const avatarFilename = request.file?.filename

  if (!avatarFilename) {
    throw new AppError('Arquivo não enviado')
  }

  return response.json({
    url: `/uploads/${avatarFilename}`
  })
})

export { uploadsRoutes } 
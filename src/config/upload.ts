import path from 'path'
import crypto from 'crypto'
import multer, { StorageEngine } from 'multer'
import fs from 'fs'

const uploadFolder = path.resolve(__dirname, '..', '..', process.env.UPLOAD_FOLDER || 'uploads')

// Criar diretório de uploads se não existir
if (!fs.existsSync(uploadFolder)) {
  fs.mkdirSync(uploadFolder, { recursive: true })
}

interface IUploadConfig {
  directory: string
  storage: StorageEngine
}

export const uploadConfig: IUploadConfig = {
  directory: uploadFolder,
  storage: multer.diskStorage({
    destination: uploadFolder,
    filename(request, file, callback) {
      const fileHash = crypto.randomBytes(10).toString('hex')
      const fileName = `${fileHash}-${file.originalname}`

      return callback(null, fileName)
    },
  }),
} 
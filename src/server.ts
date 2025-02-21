import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import 'express-async-errors'
import { routes } from './routes'
import { errorHandler } from './middlewares/errorHandler'
import { uploadConfig } from './config/upload'
import path from 'path'

const app = express()

app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')))
app.use(routes)
app.use(errorHandler)

const port = process.env.PORT || 3333

app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`)
}) 
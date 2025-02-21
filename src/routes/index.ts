import { Router } from 'express'
import { pacientesRoutes } from './pacientes.routes'
import { agendamentosRoutes } from './agendamentos.routes'
import { usuariosRoutes } from './usuarios.routes'
import { authRoutes } from './auth.routes'
import { prontuariosRoutes } from './prontuarios.routes'
import { documentosRoutes } from './documentos.routes'
import { uploadsRoutes } from './uploads.routes'
import { profissionaisRoutes } from './profissionais.routes'
import { financeiroRoutes } from './financeiro.routes'
import { dashboardRoutes } from './dashboard.routes'
import { configuracoesRoutes } from './configuracoes.routes'

const routes = Router()

routes.use('/pacientes', pacientesRoutes)
routes.use('/agendamentos', agendamentosRoutes)
routes.use('/usuarios', usuariosRoutes)
routes.use('/auth', authRoutes)
routes.use('/prontuarios', prontuariosRoutes)
routes.use('/documentos', documentosRoutes)
routes.use('/uploads', uploadsRoutes)
routes.use('/profissionais', profissionaisRoutes)
routes.use('/financeiro', financeiroRoutes)
routes.use('/dashboard', dashboardRoutes)
routes.use('/configuracoes', configuracoesRoutes)

export { routes } 
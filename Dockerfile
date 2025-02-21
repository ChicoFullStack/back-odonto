FROM node:18-alpine

# Instalando dependências necessárias
RUN apk add --no-cache openssl openssl-dev libc6-compat

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Instalando dependências e gerando o Prisma Client
RUN npm install
RUN npx prisma generate

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "dokploy-start"] 
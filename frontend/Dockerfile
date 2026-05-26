FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5173

# --host expõe o servidor Vite fora do container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

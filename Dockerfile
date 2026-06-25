FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:all
EXPOSE 3000
CMD ["npm", "run", "dashboard"]

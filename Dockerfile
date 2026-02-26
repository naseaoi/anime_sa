# -- build stage --
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# -- production stage --
FROM node:20-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && apk del python3 make g++
COPY server.js ./
COPY server/ ./server/
COPY --from=build /app/dist ./dist
RUN mkdir -p data
EXPOSE 3000
CMD ["node", "server.js"]

# -- build stage --
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_APP_VERSION=dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION
RUN npm run build

# -- production stage --
FROM node:20-alpine
WORKDIR /app

# better-sqlite3 需要 native 编译：同一层内装依赖、编译、清理，保持镜像精简
COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev \
    && apk del .build-deps \
    && npm cache clean --force

# 生产仅拷运行时代码：server.js + server/core + sharedSecurity（devMiddleware 是 dev-only）
COPY server.js ./
COPY server/core/ ./server/core/
COPY server/sharedSecurity.js ./server/
COPY --from=build /app/dist ./dist

RUN mkdir -p data
EXPOSE 3000
CMD ["node", "server.js"]

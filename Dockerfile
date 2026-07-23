# 构建阶段
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_APP_VERSION=dev
ENV VITE_APP_VERSION=$VITE_APP_VERSION
RUN npm run build

# 运行阶段
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production

# 安装生产依赖
COPY package.json package-lock.json ./
RUN apk add --no-cache su-exec \
    && apk add --no-cache --virtual .build-deps python3 make g++ \
    && npm ci --omit=dev \
    && apk del .build-deps \
    && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# 拷贝运行文件
COPY server.js ./
COPY server/core/ ./server/core/
COPY server/storage/ ./server/storage/
COPY server/sharedSecurity.js server/publicDataValidation.js ./server/
COPY shared/ ./shared/
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
COPY --from=build /app/dist ./dist

RUN mkdir -p data \
    && chown -R node:node /app \
    && chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/storage?key=ready').then((response)=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
RUN mkdir -p /data && chown node:node /data
USER node
ENV DATA_DIR=/data
EXPOSE 3000
CMD ["node", "src/server.cjs"]

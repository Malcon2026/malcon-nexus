FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY aws-api/package.json aws-api/package-lock.json* ./aws-api/
COPY worker/package.json ./worker/
RUN cd aws-api && npm install
COPY worker ./worker
COPY aws-api ./aws-api
RUN cd aws-api && npm run build

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
COPY --from=build /app/aws-api/dist ./dist
COPY --from=build /app/aws-api/node_modules ./node_modules
COPY --from=build /app/aws-api/package.json ./
EXPOSE 8080
CMD ["node", "dist/server.js"]

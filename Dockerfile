# kinefractal web: Express + built React SPA (see server/index-prod.ts)
#
# Build context = repo root. .dockerignore whitelists only what the image needs.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
# python3 for server/python/usd_correlations.py (spawned per-request);
# yfinance not installed, so that endpoint degrades until its data path is ported.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server/python ./server/python
# charts-app/charts.html: the /charts UI document, served from this image
# (fearlab-charts.ts reads it via process.cwd()). Edited in this repo; chart
# data still proxies the nightly worker store.
COPY server/charts-app ./server/charts-app
COPY client/public ./client/public
RUN useradd -m app && chown -R app /app
USER app
EXPOSE 5000
CMD ["node", "dist/index.js"]

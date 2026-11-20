FROM node:24-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends qpdf ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --include=dev --no-audit --no-fund
COPY apps/api apps/api
COPY apps/worker-node apps/worker-node
COPY packages packages
USER node
EXPOSE 8080
CMD ["npm", "run", "api"]

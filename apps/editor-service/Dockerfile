FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends libfontconfig1 libfreetype6 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev --no-fund && cd node_modules/@pdftron/pdfnet-node && node scripts/install.js
COPY server.mjs runner.mjs policy.mjs ./
USER node
EXPOSE 8081
CMD ["node","server.mjs"]

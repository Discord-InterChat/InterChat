FROM node:22-slim
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

RUN apt-get update -y && apt-get install -y openssl

WORKDIR /interchat

COPY package.json ./
COPY pnpm-lock.yaml ./
COPY src ./src
COPY scripts ./scripts
COPY locales ./locales
COPY prisma ./prisma
COPY tsconfig.json ./tsconfig.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm prisma generate
RUN pnpm run gen:locale-types
RUN pnpm run build

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

EXPOSE 3000

CMD ["pnpm", "start"]
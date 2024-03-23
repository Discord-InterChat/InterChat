FROM node:21-slim
WORKDIR /src

LABEL org.opencontainers.image.source=https://github.com/Discord-InterChat/InterChat

RUN apt-get update && apt-get install -y \
    python3 \
    build-essential &&
    rm -rf /var/lib/apt/lists/*

COPY src ./src
COPY locales ./locales
COPY prisma ./prisma
COPY tsconfig.json .
COPY package.json .
COPY .yarn ./.yarn
COPY .yarnrc.yml .

RUN yarn
RUN yarn prisma generate
RUN npm rebuild @tensorflow/tfjs-node --build-from-source

RUN yarn build
RUN yarn workspaces focus --production

EXPOSE 443
CMD ["yarn", "start"]

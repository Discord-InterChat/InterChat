FROM --platform=linux/arm64 node:21.7.0
WORKDIR /src

LABEL org.opencontainers.image.source=https://github.com/Discord-InterChat/InterChat

COPY src ./src
COPY locales ./locales
COPY prisma ./prisma
COPY tsconfig.json .
COPY package.json .
COPY yarn.lock .
COPY .yarn ./.yarn
COPY .yarnrc.yml .

RUN yarn
RUN yarn prisma generate
RUN npm rebuild @tensorflow/tfjs-node --build-from-source

RUN yarn build
RUN yarn workspaces focus --production

EXPOSE 443
CMD ["yarn", "start"]

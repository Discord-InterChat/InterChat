FROM node:21.7.0
WORKDIR /src

LABEL org.opencontainers.image.source=https://github.com/Discord-InterChat/InterChat

COPY .env.docke[r] ./.env
COPY package.json .
COPY .yarn ./.yarn
COPY .yarnrc.yml .
COPY locales ./locales
COPY yarn.lock .
COPY tsconfig.json .
COPY src ./src
COPY prisma ./prisma

RUN yarn && yarn prisma generate
RUN npm rebuild --build-from-source @tfjs/tfjs-node

RUN yarn build 
RUN yarn workspaces focus --production

EXPOSE 443 
CMD ["yarn", "start"]

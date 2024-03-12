FROM node:21-alpine

WORKDIR /app

COPY .env.docke[r] ./.env
COPY package.json .
COPY .yarn ./.yarn
COPY locales ./locales
COPY yarn.lock .

RUN yarn

COPY tsconfig.json .
COPY src ./src
COPY prisma ./prisma
COPY ecosystem.config.js .

RUN yarn build 
RUN npm prune --production

EXPOSE 443 
CMD ["yarn", "start"]

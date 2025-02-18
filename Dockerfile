FROM node:18-alpine3.20

ENV NODE_ENV=production

WORKDIR /app

COPY .env-docker ./.env

COPY ecosystem.config.js-example ./ecosystem.config.js

COPY package*.json ./

RUN npm install && npm install -g pm2

COPY . .

EXPOSE 8000

CMD [ "pm2-runtime" , "start", "ecosystem.config.js" ]
FROM node:20-alpine AS build

RUN apk add --no-cache python3 make g++ iputils
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

FROM node:20-alpine
RUN apk add --no-cache iputils
WORKDIR /app
COPY --from=build /app /app
RUN addgroup -S netwatch && adduser -S netwatch -G netwatch \
  && mkdir -p /app/data && chown -R netwatch:netwatch /app/data
USER netwatch
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/server.js"]

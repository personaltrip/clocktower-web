FROM node:18-alpine
WORKDIR /app
COPY server/package.json ./
RUN npm install --production
COPY server/index.js ./
ENV HTTP_MODE=1
EXPOSE 8080
CMD ["node", "index.js"]

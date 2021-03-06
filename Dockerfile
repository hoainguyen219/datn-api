FROM node:10-slim
WORKDIR /server
COPY ["package.json", "yarn.lock", "./"]
RUN yarn install
COPY . .
EXPOSE 5000
CMD ["yarn", "start"]

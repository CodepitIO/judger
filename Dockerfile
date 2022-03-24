FROM node:17-alpine
WORKDIR /judger
RUN npm install -g nodemon
ADD . /judger
RUN npm install
CMD node main.js
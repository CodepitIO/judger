FROM alpine:3.15

# File Author / Maintainer
LABEL org.opencontainers.image.authors="Gustavo Stor"

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    nodejs \
    npm \
    yarn

RUN apk add curl g++ make vim

# Install node dependencies
RUN yarn global add grunt-cli nodemon bower node-gyp

# Define working directory
RUN mkdir -p /judger
WORKDIR /judger

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

CMD npm run dev

# Set the base image to Ubuntu
FROM    ubuntu:14.04

# File Author / Maintainer
MAINTAINER Gustavo Stor

# Install Node.js and other dependencies
RUN apt-get update && \
    apt-get -y install curl && \
    curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash - && \
    apt-get -y install nodejs git-all build-essential vim supervisor
RUN mkdir -p /var/log/supervisor

RUN npm install -g grunt-cli nodemon

ENV WD judger

# Install node_modules and bower_components
COPY package.json /tmp/package.json
RUN cd /tmp && npm install

# Define working directory
RUN mkdir -p /${WD}
WORKDIR /${WD}
ADD . /${WD}

RUN cp -a /tmp/node_modules /${WD}/ && rm -rf /tmp

COPY .prod/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

CMD ["/usr/bin/supervisord"]

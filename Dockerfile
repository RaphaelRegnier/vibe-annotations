FROM node:20
RUN mkdir /app
WORKDIR /app
COPY . /app
RUN npm install annotations-server/
WORKDIR /app/annotations-server
CMD ["npm", "run", "start"]
EXPOSE 3846

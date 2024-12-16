# Utilizar Node
FROM node:20

# Establecer dir de trabajo
WORKDIR /usr/src/app

# Copiar los archivos de dependencias
COPY package*.json ./

# Instalar 
RUN npm install

# Copiar el resto 
COPY . .

# Puerto de la aplicación
# EXPOSE 3002

# Comando para iniciar la aplicación
CMD ["npm", "start"]

#!/bin/bash

# Define la URL
context="/cliotedge"
url="https://servicios-ging.dit.upm.es$context/threads/create"

# Define los headers para la solicitud
headers="Content-Type: application/json"

# Define el cuerpo de la solicitud con la pregunta
body=$(cat <<EOF
{
  "prompt": "¿Qué día ha habido el mayor número de personas en el huerto?"
}
EOF
)

# Realiza la solicitud para crear el thread
response=$(curl -s -X POST "$url" -H "$headers" -d "$body")

# Para mostrar la respuesta completa en el terminal
echo "$response" | jq .

# Guardamos el threadId y assistantId para usarlo después
threadId=$(echo "$response" | jq -r '.threadId')
assistantId=$(echo "$response" | jq -r '.assistantId')

# Imprime los valores extraídos
echo "Thread ID: $threadId"
echo "Assistant ID: $assistantId"

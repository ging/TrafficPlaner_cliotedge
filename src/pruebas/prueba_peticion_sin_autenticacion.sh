#!/bin/bash

context="/cliotedge"

# Define la URL para crear un nuevo thread
create_url="http://localhost:3002$context/threads/create"

# Define los headers para la solicitud
headers="Content-Type: application/json"

# Define el cuerpo de la solicitud con la pregunta inicial
create_body=$(cat <<EOF
{
  "prompt": "¿Qué son las arquitecturas RAG?"
}
EOF
)

# Realiza la solicitud para crear el thread
create_response=$(curl -s -X POST "$create_url" -H "$headers" -d "$create_body")

# Mostrar la respuesta completa por el terminal
echo "Respuesta al crear el thread:"
echo "$create_response" | jq .

# Guardar el threadId y assistantId
threadId=$(echo "$create_response" | jq -r '.threadId')
assistantId=$(echo "$create_response" | jq -r '.assistantId')

echo "Thread ID: $threadId"
echo "Assistant ID: $assistantId"

# -----------------------------------------------------------------------------------

# Define la URL para enviar un mensaje al thread existente
message_url="http://localhost:3002$context/threads/message"

# Define el cuerpo de la solicitud con el threadId, assistantId y el mensaje
message_body=$(cat <<EOF
{
  "threadId": "$threadId",
  "assistantId": "$assistantId",
  "prompt": "¿Por qué son útiles?"
}
EOF
)

# Realiza la solicitud para enviar un mensaje
message_response=$(curl -s -X POST "$message_url" -H "$headers" -d "$message_body")

# Muestra la respuesta completa por el terminal
echo "Respuesta al enviar un mensaje:"
echo "$message_response" | jq .

# -----------------------------------------------------------------------------------

# Define la URL del endpoint para eliminar el thread
delete_url="http://localhost:3002$context/threads/delete/$threadId"

# Realiza la solicitud DELETE
delete_response=$(curl -s -X DELETE "$delete_url")

# Muestra la respuesta completa
echo "Respuesta al eliminar el thread:"
echo "$delete_response" | jq .

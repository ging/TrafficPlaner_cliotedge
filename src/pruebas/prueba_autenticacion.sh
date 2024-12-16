#!/bin/bash

context="/cliotedge"

# Obtener el token
login_response=$(curl -s -X POST "http://localhost:3000$context/threads/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "user", "password": "pass"}')

# Extraer el token de la respuesta
token=$(echo "$login_response" | jq -r '.token')
echo "Token obtenido: $token"

# -----------------------------------------------------------------------------------

# Define la URL para crear un nuevo thread
create_url="http://localhost:3000$context/threads/create"

# Define los headers para la solicitud
headers=("Content-Type: application/json" "Authorization: Bearer $token")

# Define el cuerpo de la solicitud con la pregunta inicial
create_body=$(cat <<EOF
{
  "prompt": "¿Qué día ha habido el mayor número de personas en el huerto?"
}
EOF
)

# Realiza la solicitud para crear el thread
create_response=$(curl -s -X POST "$create_url" \
  -H "${headers[0]}" \
  -H "${headers[1]}" \
  -d "$create_body")

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
message_url="http://localhost:3000$context/threads/message"

# Define el cuerpo de la solicitud para el primer mensaje
message_body1=$(cat <<EOF
{
  "threadId": "$threadId",
  "assistantId": "$assistantId",
  "prompt": "¿Qué día de la semana suele haber más personas en el huerto?"
}
EOF
)

# Enviar el primer mensaje
message_response1=$(curl -s -X POST "$message_url" \
  -H "${headers[0]}" \
  -H "${headers[1]}" \
  -d "$message_body1")

# Mostrar la respuesta
echo "Respuesta al enviar el primer mensaje:"
echo "$message_response1" | jq .

# -----------------------------------------------------------------------------------

# Define el cuerpo de la solicitud para el segundo mensaje
message_body2=$(cat <<EOF
{
  "threadId": "$threadId",
  "assistantId": "$assistantId",
  "prompt": "¿Cuál es el número de personas más habitual en el huerto?"
}
EOF
)

# Enviar el segundo mensaje
message_response2=$(curl -s -X POST "$message_url" \
  -H "${headers[0]}" \
  -H "${headers[1]}" \
  -d "$message_body2")

# Mostrar la respuesta
echo "Respuesta al enviar el segundo mensaje:"
echo "$message_response2" | jq .

# -----------------------------------------------------------------------------------

# Define la URL para eliminar el thread
delete_url="http://localhost:3000$context/threads/delete/$threadId"

# Realiza la solicitud DELETE
delete_response=$(curl -s -X DELETE "$delete_url" \
  -H "${headers[1]}")

# Muestra la respuesta completa
echo "Respuesta al eliminar el thread:"
echo "$delete_response" | jq .

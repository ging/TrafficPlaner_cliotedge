// Variable para almacenar el token de autenticación
let authToken = null;

// Función para hacer login y obtener el token
async function login() {
    try {
        const response = await fetch(`${window.API_URL}${window.API_CONTEXT}/threads/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "admin",
                password: "password"
            })
        });

        if (!response.ok) {
            throw new Error('Error en el login');
        }

        const data = await response.json();
        authToken = data.token; // Guarda el token en la variable global
        console.log("Token obtenido:", authToken);
    } catch (error) {
        console.error("Error durante el login:", error);
    }
}


const context = window.API_CONTEXT;

// Crear un thread nuevo
async function createThreadAssistant() {
    // Si no hay token, se ejecuta el login primero
    if (!authToken) {
        await login();
    }

    try {
        const response = await fetch(`${window.API_URL}${window.API_CONTEXT}/threads/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken  // Se incluye el token en la cabecera
            },
            body: JSON.stringify({
                prompt: "Inicia el asistente"
            })
        });

        if (!response.ok) {
            throw new Error('Error creando el thread');
        }

        const data = await response.json();
        return [data.threadId, data.assistantId];
    } catch (error) {
        console.error("Error al crear el thread:", error);
    }
}

let threadId = null;
let assistantId = null;

// Enviar un mensaje al thread creado
const sendMessage = async (message) => {
    // Si no hay un thread, se crea uno
    if (!threadId) {
        [threadId, assistantId] = await createThreadAssistant();
    }

    console.log(`Enviando mensaje al thread ${threadId} con assistantId ${assistantId}:`, message);

    try {
        const response = await fetch(`${window.API_URL}${window.API_CONTEXT}/threads/message`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authToken
            },
            body: JSON.stringify({
                threadId,
                assistantId,
                prompt: message
            }),
        });

        if (!response.ok) {
            throw new Error('Error enviando el mensaje');
        }

        const data = await response.json();
        console.log("Mensaje enviado! Respuesta:", data);
        return data;
    } catch (error) {
        console.error("Error enviando el mensaje:", error);
    }
};

const chatInput = document.querySelector('.chat-input textarea');
const sendChatBtn = document.querySelector('.chat-input button');
const chatbox = document.querySelector(".chatbox");

let userMessage;

// Al iniciar la página se crea una conversación
(async () => {
    console.log('Creating thread...⏳');
    [threadId, assistantId] = await createThreadAssistant();
    console.log('Thread created! ✅');
})();

const createChatLi = (message, className) => {
    const chatLi = document.createElement("li");
    chatLi.classList.add("chat", className);
    chatLi.innerHTML = `<p>${message}</p>`;
    return chatLi;
};

const generateResponse = async (incomingChatLi) => {
    const messageElement = incomingChatLi.querySelector("p");

    console.log(`Sending message...⏳ ${userMessage}`);
    try {
        const response = await sendMessage(userMessage);
        console.log('Response:', response);

        const assistantResponse = response?.response?.text || 'No se pudo obtener una respuesta válida del servidor.';
        const finalMessage = assistantResponse.annotations?.[0]?.value || assistantResponse.value || assistantResponse;

        messageElement.textContent = finalMessage;
    } catch (error) {
        console.error('Error enviando el mensaje:', error);
        messageElement.textContent = 'Oops! Algo salió mal. Por favor, inténtalo de nuevo.';
    }
    chatbox.scrollTo(0, chatbox.scrollHeight);
};

const handleChat = () => {
    userMessage = chatInput.value.trim();
    if (!userMessage) {
        return;
    }
    chatbox.appendChild(createChatLi(userMessage, "chat-outgoing"));
    chatbox.scrollTo(0, chatbox.scrollHeight);

    setTimeout(() => {
        const incomingChatLi = createChatLi("Pensando...", "chat-incoming");
        chatbox.appendChild(incomingChatLi);
        chatbox.scrollTo(0, chatbox.scrollHeight);
        generateResponse(incomingChatLi);
    }, 600);
};

sendChatBtn.addEventListener("click", handleChat);

// Resetear el chat y crear un nuevo hilo
async function startNewThread() {
    console.log('Creating thread...⏳');
    [threadId, assistantId] = await createThreadAssistant();
    console.log('Thread created! ✅');
}

// Eliminar un hilo por su identificador
const deleteThread = async (threadId) => {
    try {
        const response = await fetch(`${window.API_URL}${window.API_CONTEXT}/threads/delete/${threadId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + authToken
            },
        });

        if (!response.ok) {
            throw new Error('Error eliminando el thread');
        }

        const data = await response.json();
        console.log('Thread eliminado:', data.message);
    } catch (error) {
        console.error("Error eliminando el thread:", error);
    }
};


// Resetear el chat y crear un nuevo hilo
async function resetChat() {
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.innerHTML = ''; // Limpia el chat

    // Si existe un threadId, eliminar el hilo anterior
    if (threadId) {
        await deleteThread(threadId);
    }

    // Crear un nuevo hilo
    await startNewThread();
}

document.getElementById('resetChatButton').addEventListener('click', resetChat);

// Crear un thread nuevo
async function createThreadAssistant() {
    try {
        const response = await fetch('http://localhost:3000/threads/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
    // Verificamos si threadId y assistantId están definidos
    if (!threadId) {
        // Si no existe, se crea un thread
        [threadId, assistantId] = await createThreadAssistant(); 
    }

    // Tiene que haber un mensaje
    if (!message) {
        console.error("El mensaje no puede estar vacío.");
        return;
    }

    try {
        const response = await fetch('http://localhost:3000/threads/message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
        console.log("Message sent! Response:", data);
        return data;
    } catch (error) {
        console.error("Error enviando el mensaje:", error);
    }
};

const chatInput = document.querySelector('.chat-input textarea');
const sendChatBtn = document.querySelector('.chat-input button');
const chatbox = document.querySelector(".chatbox");

let userMessage;

// Al inicar la página se crea una conversación
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
}

const generateResponse = async (incomingChatLi) => {
    const messageElement = incomingChatLi.querySelector("p");

    console.log(`Sending message...⏳ ${userMessage}`);
    try {
        const response = await sendMessage(userMessage); 
        console.log('Response:', response);

        // Verificar si response.text.annotations[0].value existe de forma segura
        const assistantResponse = response?.response?.text || 'No se pudo obtener una respuesta válida del servidor.';
        const finalMessage = assistantResponse.annotations?.[0]?.value || assistantResponse.value || assistantResponse;

        messageElement.textContent = finalMessage;
    } catch (error) {
        console.error('Error enviando el mensaje:', error);
        messageElement.textContent = 'Oops! Algo salió mal. Por favor, inténtalo de nuevo.';
    }
    chatbox.scrollTo(0, chatbox.scrollHeight);
}

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
}

sendChatBtn.addEventListener("click", handleChat);

// Resetear el chat y crear un nuevo hilo
async function startNewThread() {
    console.log('Creating thread...⏳');
    [threadId, assistantId] = await createThreadAssistant(); // Asignar valores a las variables
    console.log('Thread created! ✅');
}

// Eliminar un hilo por su identificador
const deleteThread = async (threadId) => {
    try {
        const response = await fetch(`http://localhost:3000/threads/delete/${threadId}`, {
            method: 'DELETE',
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

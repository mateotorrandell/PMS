// js/configuracion.js
// Versión que usa number/name y dataService
import { getRoomData, addRoomData, deleteRoomData } from './dataservice.js';

// --- Referencias DOM ---
const roomForm = document.getElementById('add-room-form');
const roomNumberInput = document.getElementById('room-number');
const roomNameInput = document.getElementById('room-name');
const roomColorInput = document.getElementById('room-color');
const roomListElement = document.getElementById('room-list');
const numberErrorElement = document.getElementById('number-error');
const submitButton = roomForm?.querySelector('button[type="submit"]');

// --- Estado Local ---
let currentRooms = [];

// --- Funciones UI ---
function showLoadingMessage() { /* ... como antes ... */
     if (roomListElement) roomListElement.innerHTML = '<li><em style="color:#666;">Cargando habitaciones...</em></li>';
}
function showErrorMessage(message) { /* ... como antes ... */
     if (roomListElement) roomListElement.innerHTML = `<li><strong style="color:red;">Error:</strong> ${message || 'Error desconocido'}</li>`;
}
function clearFormErrors() { /* ... como antes ... */
     if(numberErrorElement) { numberErrorElement.style.display = 'none'; numberErrorElement.textContent = ''; }
}
function disableForm(disabled = true) { /* ... como antes ... */
    if(submitButton) submitButton.disabled = disabled;
    if(roomNumberInput) roomNumberInput.disabled = disabled;
    if(roomNameInput) roomNameInput.disabled = disabled;
    if(roomColorInput) roomColorInput.disabled = disabled;
    if(submitButton) submitButton.textContent = disabled ? 'Guardando...' : 'Añadir Habitación';
}

function renderRoomList() {
    console.log("Rendering list with currentRooms:", JSON.stringify(currentRooms));
    if (!roomListElement) { return; }
    roomListElement.innerHTML = '';
    clearFormErrors();
    if (!Array.isArray(currentRooms)) { showErrorMessage("Datos inválidos."); return; }

    // Usa claves number, name, color que vienen de la API
    const sortedRooms = [...currentRooms].sort((a, b) => Number(a.number) - Number(b.number));

    if (sortedRooms.length === 0) {
        roomListElement.innerHTML = '<li>No hay habitaciones configuradas.</li>'; return;
    }

    sortedRooms.forEach((room, index) => {
        // Validación simple (basada en la que funcionó)
         if (!room || typeof room.number === 'undefined' || typeof room.name === 'undefined' || typeof room.color === 'undefined' || typeof room.id === 'undefined') {
             console.warn(`[Room ${index}] Saltando renderizado (datos inválidos):`, room);
             return;
         }
        console.log(`[Room ${index}] Rendering valid room.`); // Log éxito validación

        const li = document.createElement('li'); li.dataset.roomId = room.id;
        const roomInfo = document.createElement('div'); roomInfo.classList.add('room-info');
        const colorSwatch = document.createElement('span'); colorSwatch.classList.add('room-color-swatch');
        colorSwatch.style.backgroundColor = room.color; colorSwatch.title = `Color: ${room.color}`;
        const roomNumberSpan = document.createElement('span'); roomNumberSpan.classList.add('room-number');
        roomNumberSpan.textContent = room.number; // Usa number
        const roomNameSpan = document.createElement('span'); roomNameSpan.classList.add('room-name');
        roomNameSpan.textContent = room.name; // Usa name
        roomInfo.appendChild(colorSwatch); roomInfo.appendChild(roomNumberSpan); roomInfo.appendChild(roomNameSpan);
        const roomActions = document.createElement('div'); roomActions.classList.add('room-actions');
        const deleteButton = document.createElement('button'); deleteButton.innerHTML = '&times;'; deleteButton.title = 'Eliminar';
        deleteButton.addEventListener('click', (e) => {
            e.currentTarget.disabled = true;
            handleDeleteRoom(room.id).finally(() => {
                 try { const btn = roomListElement?.querySelector(`li[data-room-id="${room.id}"] button`); if (btn) btn.disabled = false; } catch(err){}
            });
        });
        roomActions.appendChild(deleteButton);
        li.appendChild(roomInfo); li.appendChild(roomActions);
        roomListElement.appendChild(li);
    });
}

// --- Lógica de Datos ---
async function loadAndRenderRooms() {
    showLoadingMessage();
    try {
        currentRooms = await getRoomData(); // Llama a API GET /api/rooms.php
        renderRoomList();
    } catch (error) {
        console.error("Error al cargar habitaciones:", error);
        showErrorMessage(error.message);
        currentRooms = []; renderRoomList();
    }
}

async function handleAddRoom(event) {
    event.preventDefault(); clearFormErrors();
    const numberStr = roomNumberInput.value.trim();
    const name = roomNameInput.value.trim();
    const color = roomColorInput.value;
    if (!numberStr || isNaN(parseInt(numberStr, 10)) || parseInt(numberStr, 10) <= 0) { /* ... error ... */ return; }
    const number = parseInt(numberStr, 10);
    if (!name) { /* ... error ... */ return; }
    if (!color) { /* ... error ... */ return; }

    const newRoomData = { number, name, color }; // Enviar claves en inglés
    disableForm(true);
    try {
        const addedRoomResponse = await addRoomData(newRoomData); // Llama a API POST /api/rooms.php
        if (addedRoomResponse.success && addedRoomResponse.data) {
             // OPTIMISTA: Añadir localmente y re-renderizar
             const roomFromApi = addedRoomResponse.data; // API devuelve number, name, color
             if (!currentRooms.some(r => r.id === roomFromApi.id)) { currentRooms.push(roomFromApi); }
             renderRoomList();
             roomForm.reset(); roomColorInput.value = '#e0e0e0'; roomNumberInput.focus();
             // Podríamos llamar a loadAndRenderRooms() igual para asegurar sincronización total
             // await loadAndRenderRooms();
        } else { throw new Error(addedRoomResponse.message || "La API no confirmó la adición."); }
    } catch (error) {
        console.error("Error en handleAddRoom:", error);
        numberErrorElement.textContent = error.message; numberErrorElement.style.display = 'block'; roomNumberInput.focus();
    } finally { disableForm(false); }
}

async function handleDeleteRoom(roomIdToDelete) {
     const roomToDelete = currentRooms.find(r => r.id == roomIdToDelete);
     if (!roomToDelete || !confirm(`¿Eliminar habitación ${roomToDelete.number}?`)) { return; }
    try {
        await deleteRoomData(roomIdToDelete); // Llama a API DELETE /api/rooms.php?id=...
        // Recargar lista completa para reflejar el cambio
        await loadAndRenderRooms();
    } catch (error) { console.error("Error en handleDeleteRoom:", error); alert(`Error: ${error.message}`); }
}

// --- Inicialización ---
document.addEventListener('DOMContentLoaded', () => {
    if (roomForm) { roomForm.addEventListener('submit', handleAddRoom); }
    else { console.error("Formulario add-room-form no encontrado."); }
    loadAndRenderRooms(); // Carga inicial
});
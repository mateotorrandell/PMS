// js/dataService.js
// VERSIÓN COMPLETA CON FUNCIONES PARA EDITAR RESERVAS

// --- API Endpoints ---
const ROOMS_API_ENDPOINT = '/api/rooms.php';
const OPTIONS_API_ENDPOINT = '/api/options.php';
const RESERVATIONS_API_ENDPOINT = '/api/reservations.php';

// --- Manejo de Errores Centralizado (Helper) ---
async function handleApiResponse(response, context) {
    let responseData; const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
        try { responseData = await response.json(); }
        catch (e) { const text = await response.text().catch(() => '[Error texto]'); throw new Error(`Error parsear JSON ${context}: ${e.message}. Resp: ${text.substring(0, 100)}`); }
    } else { const text = await response.text().catch(() => '[Error texto]'); if (response.ok) { throw new Error(`Resp inesperada (no JSON) ${context}. Status: ${response.status}. Cont: ${text.substring(0,100)}`); } else { throw new Error(`Error ${response.status} ${context}. Resp: ${text}`); } }
    if (!response.ok) { throw new Error(`Error ${response.status} ${context}: ${responseData?.message || 'Error API s/msj.'}`); }
    if (responseData.success === false) { throw new Error(`Error API ${context}: ${responseData?.message || 'Fallo API s/msj.'}`); }
    return responseData;
}


// --- Funciones para Habitaciones (API) ---
export async function getRoomData() { /* ... como estaba ... */
    try { const response = await fetch(ROOMS_API_ENDPOINT); const responseText = await response.text(); if (!response.ok) { throw new Error(`HTTP ${response.status} (Rooms GET): ${responseText || response.statusText}`); } const rooms = JSON.parse(responseText); if (!Array.isArray(rooms)) { throw new Error(`Respuesta inválida (rooms): no es array.`); } return rooms; }
    catch (error) { console.error("Error en getRoomData:", error); throw error; }
}
export async function addRoomData(roomData) { /* ... como estaba ... */
    try { const response = await fetch(ROOMS_API_ENDPOINT, { method: 'POST', headers: {'Content-Type': 'application/json', 'Accept': 'application/json'}, body: JSON.stringify(roomData) }); const result = await handleApiResponse(response, "al añadir habitación"); return result; } catch (error) { console.error("Error en addRoomData:", error); throw error; }
}
export async function deleteRoomData(roomId) { /* ... como estaba ... */
    try { const response = await fetch(`${ROOMS_API_ENDPOINT}?id=${roomId}`, { method: 'DELETE', headers: { 'Accept': 'application/json' } }); const result = await handleApiResponse(response, `al eliminar habitación ID ${roomId}`); return result; } catch (error) { console.error(`Error en deleteRoomData(${roomId}):`, error); throw error; }
}

// --- Funciones para Opciones (API) ---
export async function getOptions(type) { /* ... como estaba ... */
    try { const response = await fetch(`${OPTIONS_API_ENDPOINT}?type=${type}`); const result = await handleApiResponse(response, `al obtener opciones '${type}'`); return result.data; } catch (error) { console.error(`Error en getOptions(${type}):`, error); throw error; }
}
export async function addOption(type, optionData) { /* ... como estaba ... */
    try { const response = await fetch(`${OPTIONS_API_ENDPOINT}?type=${type}`, { method: 'POST', headers: {'Content-Type': 'application/json', 'Accept': 'application/json'}, body: JSON.stringify(optionData) }); const result = await handleApiResponse(response, `al añadir opción '${type}'`); return result; } catch (error) { console.error(`Error en addOption(${type}):`, error); throw error; }
}
export async function deleteOption(type, id) { /* ... como estaba ... */
    try { const response = await fetch(`${OPTIONS_API_ENDPOINT}?type=${type}&id=${id}`, { method: 'DELETE', headers: { 'Accept': 'application/json' } }); const result = await handleApiResponse(response, `al eliminar opción '${type}' ID ${id}`); return result; } catch (error) { console.error(`Error en deleteOption(${type}, ${id}):`, error); throw error; }
}

// --- Funciones para Reservas (API) ---

/** Obtiene las reservas para un período. */
export async function getReservationsForPeriod(startDate, endDate) {
    const startStr = startDate.toISOString().split('T')[0]; const endStr = endDate.toISOString().split('T')[0]; const url = `${RESERVATIONS_API_ENDPOINT}?startDate=${startStr}&endDate=${endStr}`; console.log(`DS: Fetching reservations from: ${url}`);
    try { const response = await fetch(url); const result = await handleApiResponse(response, `al obtener reservas ${startStr} a ${endStr}`); if (!Array.isArray(result.data)) { throw new Error("Formato inesperado (reservas)."); } console.log(`DS: ${result.data.length} reserv. fetched.`); return result.data; }
    catch (error) { console.error(`Error en getReservationsForPeriod:`, error); throw error; }
}

/** Obtiene una reserva específica por ID. */
export async function getReservationById(id) {
    if (!id || id <= 0) { throw new Error("ID inválido para getReservationById."); } const url = `${RESERVATIONS_API_ENDPOINT}?id=${id}`; console.log(`DS: Fetching reservation ID: ${id}`);
    try { const response = await fetch(url); const result = await handleApiResponse(response, `al obtener reserva ID ${id}`); if (!result.data || typeof result.data !== 'object') { throw new Error("Formato inesperado (reserva ID)."); } console.log("DS: Reservation data fetched:", result.data); return result.data; }
    catch (error) { console.error(`Error en getReservationById(${id}):`, error); throw error; }
}

/** Añade una nueva reserva. */
export async function addReservation(reservationData) {
    console.log("DS: Adding reservation:", JSON.stringify(reservationData)); let response;
    try { response = await fetch(RESERVATIONS_API_ENDPOINT, { method: 'POST', headers: {'Content-Type': 'application/json', 'Accept': 'application/json'}, body: JSON.stringify(reservationData) }); const result = await handleApiResponse(response, "al añadir reserva"); return result; }
    catch (error) { console.error("Error en addReservation:", error); if (response && !response.ok) { try { const errBody = await response.json(); console.error("API Error Body (add):", errBody); if (errBody?.message) throw new Error(errBody.message); } catch(e){} } throw error; }
}

/** Actualiza una reserva existente. */
export async function updateReservation(id, reservationData) {
    if (!id || id <= 0) { throw new Error("ID inválido para updateReservation."); } console.log(`DS: Updating reservation ID: ${id}`, JSON.stringify(reservationData)); let response;
    try { response = await fetch(`${RESERVATIONS_API_ENDPOINT}?id=${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json', 'Accept': 'application/json'}, body: JSON.stringify(reservationData) }); const result = await handleApiResponse(response, `al actualizar reserva ID ${id}`); return result; }
    catch (error) { console.error(`Error en updateReservation(${id}):`, error); if (response && !response.ok) { try { const errBody = await response.json(); console.error("API Error Body (update):", errBody); if (errBody?.message) throw new Error(errBody.message); } catch(e){} } throw error; }
}

/** Elimina una reserva (placeholder). */
export async function deleteReservation(id) {
    if (!id || id <= 0) { throw new Error("ID inválido para deleteReservation."); }
    console.warn(`DS: deleteReservation(${id}) llamada, pero el backend (DELETE /api/reservations.php) no está implementado.`);
    return Promise.reject(new Error("Función DELETE aún no implementada en backend."));
    // try { /* const response = await fetch(...); const result = await handleApiResponse(...); return result; */ } catch (error) { throw error; }
}

console.log("DS: dataService.js cargado (Versión API Reservas Completa).");
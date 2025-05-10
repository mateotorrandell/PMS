// js/gantt/ganttRenderer.js
// VERSIÓN LIMPIA: Elimina estilos inline de debug, confía en CSS externo para .reservation-block

import * as config from '../config.js';
import { formatDate, addDays, formatHeaderDate, calculateDaysBetween } from '../utils/dates.js';
import { getReservationsForPeriod } from '../dataservice.js';

// --- Helper: Calcular posición y tamaño (Sin cambios) ---
function calculateGridPosition(reservation, viewStartDate, numVisibleDays) {
    try {
        const viewEndDate = addDays(viewStartDate, numVisibleDays);
        const resStartDate = new Date(reservation.fecha_ingreso + 'T00:00:00Z');
        const resEndDate = new Date(reservation.fecha_salida + 'T00:00:00Z');
        if (isNaN(resStartDate.getTime()) || isNaN(resEndDate.getTime()) || resEndDate <= viewStartDate || resStartDate >= viewEndDate) { return null; }
        let startCol = 2; if (resStartDate > viewStartDate) { startCol = calculateDaysBetween(formatDate(viewStartDate), formatDate(resStartDate)) + 2; }
        let endCol = numVisibleDays + 2; if (resEndDate < viewEndDate) { endCol = calculateDaysBetween(formatDate(viewStartDate), formatDate(resEndDate)) + 2; }
        if (startCol >= endCol || endCol < 2 ) { console.warn(`[calculateGridPosition] Calc inválido Res ID ${reservation.id}: start=${startCol}, end=${endCol}`); return null; }
        const finalStartCol = Math.max(2, startCol); const finalEndCol = Math.min(numVisibleDays + 2, endCol);
         if (finalStartCol >= finalEndCol) { console.warn(`[calculateGridPosition] Ajuste inválido Res ID ${reservation.id}: start=${finalStartCol}, end=${finalEndCol}`); return null; }
        return { startCol: finalStartCol, endCol: finalEndCol };
    } catch (e) { console.error(`[calculateGridPosition] Error Res ID ${reservation?.id}:`, e); return null; }
}

// --- Función Principal para Dibujar Reservas ---
async function drawReservations(gridElement, reservations, viewStartDate, roomData) {
    console.log(`[drawReservations] Iniciando. Dibujando ${reservations ? reservations.length : 0} reservas.`);
    if (!gridElement || !Array.isArray(reservations) || !Array.isArray(roomData)) { return; }

    const roomRowMap = new Map(roomData.map((room, index) => [room.id, index + 2]));
    // console.log("[drawReservations] Mapa Habitación->Fila:", roomRowMap); // Opcional

    reservations.forEach((res, index) => {
        // console.log(`[drawReservations] Procesando reserva ${index + 1}: ID=${res.id}, HabID=${res.habitacion_id}`); // Opcional
        const roomRow = roomRowMap.get(res.habitacion_id);
        if (!roomRow) { console.warn(`   -> No se encontró fila para hab_id ${res.habitacion_id}. Saltando.`); return; }
        const position = calculateGridPosition(res, viewStartDate, config.NUM_VISIBLE_DAYS);
        // console.log(`   -> Posición calculada:`, position); // Opcional

        if (position) {
            try {
                const reservationBlock = document.createElement('div');
                reservationBlock.classList.add('reservation-block'); // Clase principal para estilos CSS
                reservationBlock.dataset.reservaId = res.id; // ID para identificar la reserva

                // --- ESTILOS ESENCIALES (Posición en Grid y Color) ---
                reservationBlock.style.gridRow = `${roomRow}`;
                reservationBlock.style.gridColumn = `${position.startCol} / ${position.endCol}`;
                reservationBlock.style.backgroundColor = res.estado_color || '#A0A0A0'; // Color de fondo del estado

                 // Añadir clase específica del estado para CSS más avanzado (opcional)
                 // ej: reservationBlock.classList.add(`status-${res.estado_nombre?.toLowerCase().replace(' ','-') || 'desconocido'}`);

                // --- Contenido y Tooltip ---
                reservationBlock.textContent = `${res.huesped_nombre || ''}`.trim() || `Res #${res.id}`;
                reservationBlock.title = `Reserva #${res.numero_reserva || res.id}\nHab: ${res.habitacion_id} | ${res.fecha_ingreso} - ${res.fecha_salida}\nHuésped: ${res.huesped_nombre || ''} ${res.huesped_apellido || ''}\nEstado: ${res.estado_nombre || 'Desconocido'}`;

                // console.log(`   -> Creando bloque DIV: row=${roomRow}, col=${position.startCol}/${position.endCol}`); // Opcional
                gridElement.appendChild(reservationBlock); // Añadir al grid

            } catch (e) { console.error(`   -> Error al crear/añadir bloque DIV para reserva ID ${res.id}:`, e); }
        } // else { console.log(`   -> Reserva fuera de la vista.`); } // Opcional
    });
    console.log("[drawReservations] Finalizado.");
}


// --- Función Principal para Renderizar el Gantt Completo ---
export async function renderGantt(gridElement, startDate, datePickerElement, roomData) {
    console.log(`[renderGantt] Iniciando. StartDate: ${formatDate(startDate)}. Rooms: ${roomData.length}`);
    if (!gridElement || !(startDate instanceof Date) || isNaN(startDate) || !Array.isArray(roomData)) { console.error("[renderGantt] Args inválidos."); return; }

    const numRooms = roomData.length;
    gridElement.innerHTML = '';
    // Ya no es necesario 'position: relative' aquí si los bloques no son absolutos
    gridElement.style.gridTemplateColumns = `${config.ROOM_HEADER_WIDTH} repeat(${config.NUM_VISIBLE_DAYS}, ${config.CELL_WIDTH})`;
    gridElement.style.gridTemplateRows = `${config.DATE_HEADER_HEIGHT} repeat(${numRooms > 0 ? numRooms : 1}, ${config.CELL_HEIGHT})`;

    // Crear esquina... (Sin cambios)
    const cornerCell = document.createElement('div'); cornerCell.classList.add('grid-cell', 'header-cell', 'header-corner'); cornerCell.textContent = 'Habitación'; cornerCell.style.gridRow = '1'; cornerCell.style.gridColumn = '1'; gridElement.appendChild(cornerCell);
    // Crear Cabeceras de Fechas... (Sin cambios)
    const dateHeaders = []; for (let i = 0; i < config.NUM_VISIBLE_DAYS; i++) { const currentDate = addDays(startDate, i); const dateString = formatDate(currentDate); dateHeaders.push(dateString); const dateCell = document.createElement('div'); dateCell.classList.add('grid-cell', 'header-cell', 'date-header'); dateCell.textContent = formatHeaderDate(currentDate); dateCell.title = dateString; dateCell.dataset.date = dateString; dateCell.style.gridRow = '1'; dateCell.style.gridColumn = `${i + 2}`; gridElement.appendChild(dateCell); }
    // Crear Cabeceras de Habitaciones y Celdas del Cuerpo... (Sin cambios)
    if (numRooms === 0) { /* Mensaje "No hay habitaciones" */ } else { roomData.forEach((room, roomIndex) => { const roomCell = document.createElement('div'); roomCell.classList.add('grid-cell', 'header-cell', 'room-header'); roomCell.innerHTML = `<span class="room-number">${room.number || '?'}</span><span class="room-name">${room.name || 'Sin Nombre'}</span>`; roomCell.title = `Habitación ${room.number || '?'} (ID: ${room.id})`; roomCell.style.backgroundColor = room.color || '#E0E0E0'; roomCell.style.gridRow = `${roomIndex + 2}`; roomCell.style.gridColumn = '1'; gridElement.appendChild(roomCell); for (let dayIndex = 0; dayIndex < config.NUM_VISIBLE_DAYS; dayIndex++) { const bodyCell = document.createElement('div'); bodyCell.classList.add('grid-cell', 'body-cell'); bodyCell.dataset.roomId = room.id; bodyCell.dataset.roomNumber = room.number; bodyCell.dataset.date = dateHeaders[dayIndex]; bodyCell.title = `Habitación ${room.number || '?'} - ${dateHeaders[dayIndex]}`; bodyCell.style.gridRow = `${roomIndex + 2}`; bodyCell.style.gridColumn = `${dayIndex + 2}`; gridElement.appendChild(bodyCell); } }); }

    // Actualizar Date Picker... (Sin cambios)
    if (datePickerElement) { try { datePickerElement.value = formatDate(startDate); } catch (e) { /*...*/ } }

    // --- Obtener y Dibujar Reservas ---
    console.log("[renderGantt] Obteniendo reservas...");
    requestAnimationFrame(async () => {
        const viewEndDateForAPI = addDays(startDate, config.NUM_VISIBLE_DAYS);
        try {
            const reservations = await getReservationsForPeriod(startDate, viewEndDateForAPI);
            await drawReservations(gridElement, reservations, startDate, roomData);
        } catch (error) { console.error("[renderGantt] Error al obtener/dibujar reservas:", error); /* Mostrar error overlay */ }
    });
    console.log("[renderGantt] Renderizado base completado.");
} // Fin renderGantt
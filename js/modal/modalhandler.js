// js/modal/modalhandler.js
// VERSIÓN CORREGIDA FINAL: Sin funciones duplicadas, incluye lógica de edición y IDs originales HTML.

import { calculateDaysBetween, formatDate, getTodayDate, addDays } from '../utils/dates.js';
import { addReservation, getReservationById, updateReservation, getOptions } from '../dataservice.js';
import * as config from '../config.js';

// --- Estado Local ---
let availableRoomsData = [];
let loadedOptions = { statuses: [], sale_types: [], channels: [] };
let isEditing = false;

// --- Referencias a Elementos DOM ---
let modalElement = null, overlayElement = null, closeBtnElement = null, formElement = null,
    checkinElement = null, checkoutElement = null, nochesElement = null, horaInElement = null,
    horaOutElement = null, adultosElement = null, menoresElement = null, numeroReservaElement = null,
    cancelBtnElement = null, saveButton = null, numeroHabSelect = null, tipoHabDisplay = null,
    estadoSelect = null, tipoVentaSelect = null, canalVentaSelect = null, huespedNombreElement = null,
    huespedApellidoElement = null, formErrorElement = null, huespedEmailElement = null,
    huespedTelefonoElement = null, huespedDniElement = null, precioElement = null,
    comentarioElement = null, patenteElement = null, modalTitleElement = null, resIdHiddenInput = null;

// Nuevas referencias DOM para el folio
let btnOtrosCargos = null, btnPagos = null, btnResumen = null,
    folioItems = null, totalDebito = null, totalCredito = null, saldoFinal = null;

// --- Funciones Auxiliares (Definidas UNA SOLA VEZ) ---

function populateOptionsSelect(selectElement, optionsData, selectedValue = null, defaultText = "Seleccionar...") {
    if (!selectElement) { console.error("MH Error: Elemento Select no encontrado:", selectElement?.id); return; }
    selectElement.innerHTML = `<option value="" disabled>${defaultText}</option>`;
    selectElement.disabled = (!optionsData || optionsData.length === 0);
    if (!Array.isArray(optionsData) || optionsData.length === 0) { selectElement.options[0].textContent = "No hay opciones"; selectElement.value = ''; return; }
    const sortedOptions = [...optionsData].sort((a, b) => a.nombre?.localeCompare(b.nombre));
    sortedOptions.forEach(option => {
        if (option && typeof option.id !== 'undefined' && typeof option.nombre !== 'undefined') {
            const opt = document.createElement('option'); opt.value = option.id; opt.textContent = option.nombre;
            if (option.color) { opt.dataset.color = option.color; } selectElement.appendChild(opt);
        }
    });
    if (selectedValue !== null && selectElement.querySelector(`option[value="${selectedValue}"]`)) { selectElement.value = selectedValue; }
    else { selectElement.selectedIndex = 0; }
}

function populateRoomNumberSelect(selectElement, rooms, selectedRoomNumber) {
    if (!selectElement) { console.error("MH Error: Select Nro Hab no encontrado!"); return; }
    selectElement.innerHTML = '<option value="" disabled>Seleccionar...</option>';
    if (!Array.isArray(rooms)) { rooms = []; } selectElement.disabled = (rooms.length === 0);
    if (rooms.length === 0) { selectElement.options[0].textContent = "No hay habs."; return; }
    const sortedRooms = [...rooms].sort((a, b) => Number(a.number) - Number(b.number));
    sortedRooms.forEach(room => {
        if (room && typeof room.number !== 'undefined' && typeof room.name !== 'undefined') {
            const opt = document.createElement('option'); opt.value = room.number; opt.textContent = `${room.number} (${room.name})`;
            opt.dataset.roomType = room.name; opt.dataset.roomId = room.id; selectElement.appendChild(opt);
        } else { console.warn("MH: Habitación inválida encontrada:", room); }
    });
    if (selectedRoomNumber !== undefined && selectedRoomNumber !== null) {
        selectElement.value = selectedRoomNumber;
        if(selectElement.value === "" && selectedRoomNumber !== "") { console.warn(`MH: No se encontró opción hab '${selectedRoomNumber}'.`); selectElement.selectedIndex = 0; }
    } else { selectElement.selectedIndex = 0; }
    if (selectElement.value) { selectElement.dispatchEvent(new Event('change')); }
}

function updateRoomTypeDisplay() {
    if (!numeroHabSelect || !tipoHabDisplay) return;
    const o = numeroHabSelect.options[numeroHabSelect.selectedIndex];
    tipoHabDisplay.value = (o && o.dataset.roomType) ? o.dataset.roomType : '';
}

function updateNightsDisplay() {
    if (!checkinElement || !checkoutElement || !nochesElement) return;
    const i = checkinElement.value; const o = checkoutElement.value;
    const n = calculateDaysBetween(i, o);
    nochesElement.textContent = n > 0 ? `${n} noche${n > 1 ? 's' : ''}` : '0';
}

function resetForm() {
    if (!formElement) return; formElement.reset(); isEditing = false;
    if(resIdHiddenInput) resIdHiddenInput.value = '';
    if(modalTitleElement) modalTitleElement.textContent = "Formulario de Reserva";
    if(numeroReservaElement) numeroReservaElement.textContent = "Generado Automáticamente";
    if(checkinElement) checkinElement.value = formatDate(getTodayDate());
    if(checkoutElement) checkoutElement.value = ''; if(nochesElement) nochesElement.textContent = '0';
    if(horaInElement) horaInElement.value = config.DEFAULT_CHECKIN_TIME; if(horaOutElement) horaOutElement.value = config.DEFAULT_CHECKOUT_TIME;
    if(adultosElement) adultosElement.value = config.DEFAULT_ADULTS; if(menoresElement) menoresElement.value = config.DEFAULT_MINORS;
    if(numeroHabSelect) numeroHabSelect.value = ''; if(tipoHabDisplay) tipoHabDisplay.value = '';
    if(estadoSelect) estadoSelect.value = '7'; // Default Pendiente
    if(tipoVentaSelect) tipoVentaSelect.value = ''; if(canalVentaSelect) canalVentaSelect.value = '';
    if(formErrorElement) { formErrorElement.textContent = ''; formErrorElement.style.display = 'none'; }
    console.log("MH: Formulario reseteado.");
}

function closeModal() {
    if (modalElement) { modalElement.style.display = 'none'; resetForm(); }
}

function openModalForNew(roomNumber, date) {
    if (!modalElement) { console.error("MH Error: Modal no encontrado."); return; }
    console.log(`MH: Abriendo modal NUEVA. Hab: ${roomNumber}, Fecha: ${date}.`);
    resetForm();
    populateRoomNumberSelect(numeroHabSelect, availableRoomsData, roomNumber);
    if (date && checkinElement) { try { if (/^\d{4}-\d{2}-\d{2}$/.test(date)) { const d = new Date(date + 'T00:00:00Z'); if (!isNaN(d.getTime())) { checkinElement.value = date; if (checkoutElement) { const n = new Date(d); n.setUTCDate(n.getUTCDate() + 1); checkoutElement.value = formatDate(n); } } } } catch (e) {} }
    populateOptionsSelect(estadoSelect, loadedOptions.statuses, '7');
    populateOptionsSelect(tipoVentaSelect, loadedOptions.sale_types);
    populateOptionsSelect(canalVentaSelect, loadedOptions.channels);
    updateNightsDisplay(); updateRoomTypeDisplay();
    console.log("MH openModalForNew: Intentando mostrar modalElement:", modalElement);
    if (modalElement && typeof modalElement.style !== 'undefined') {
        modalElement.style.display = 'block';
        console.log("MH openModalForNew: display = 'block' establecido.");
        if(huespedNombreElement) { try { huespedNombreElement.focus(); } catch(e) {} }
    } else { console.error("MH openModalForNew: modalElement inválido!"); }
}

function openModalForEdit(reservationData) {
    if (!modalElement || !formElement) { return; } if (!reservationData || typeof reservationData !== 'object') { return; }
    console.log(`MH: Abriendo modal EDITAR ID: ${reservationData.id}`);
    resetForm(); isEditing = true;
    if(modalTitleElement) modalTitleElement.textContent = `Editar Reserva #${reservationData.numero_reserva || reservationData.id}`;
    if(resIdHiddenInput) resIdHiddenInput.value = reservationData.id;
    if(numeroReservaElement) numeroReservaElement.textContent = reservationData.numero_reserva || `ID: ${reservationData.id}`;
    // Poblar campos...
    if(checkinElement) checkinElement.value = reservationData.fecha_ingreso || ''; if(checkoutElement) checkoutElement.value = reservationData.fecha_salida || ''; if(horaInElement) horaInElement.value = reservationData.hora_ingreso?.substring(0, 5) ?? config.DEFAULT_CHECKIN_TIME; if(horaOutElement) horaOutElement.value = reservationData.hora_salida?.substring(0, 5) ?? config.DEFAULT_CHECKOUT_TIME; if(huespedNombreElement) huespedNombreElement.value = reservationData.huesped_nombre ?? ''; if(huespedApellidoElement) huespedApellidoElement.value = reservationData.huesped_apellido ?? ''; if(huespedEmailElement) huespedEmailElement.value = reservationData.huesped_email ?? ''; if(huespedTelefonoElement) huespedTelefonoElement.value = reservationData.huesped_telefono ?? ''; if(huespedDniElement) huespedDniElement.value = reservationData.dni ?? ''; if(adultosElement) adultosElement.value = reservationData.adultos ?? config.DEFAULT_ADULTS; if(menoresElement) menoresElement.value = reservationData.menores ?? config.DEFAULT_MINORS; if(precioElement) precioElement.value = reservationData.precio_total ?? ''; if(comentarioElement) comentarioElement.value = reservationData.comentario || ''; if(patenteElement) patenteElement.value = reservationData.patente || '';
    const roomForReservation = availableRoomsData.find(r => r.id === reservationData.habitacion_id);
    populateRoomNumberSelect(numeroHabSelect, availableRoomsData, roomForReservation?.number);
    populateOptionsSelect(estadoSelect, loadedOptions.statuses, reservationData.estado_id); populateOptionsSelect(tipoVentaSelect, loadedOptions.sale_types, reservationData.tipo_venta_id); populateOptionsSelect(canalVentaSelect, loadedOptions.channels, reservationData.canal_venta_id);
    updateNightsDisplay(); updateRoomTypeDisplay();
    console.log("MH openModalForEdit: Intentando mostrar modalElement:", modalElement);
    if (modalElement && typeof modalElement.style !== 'undefined') {
        modalElement.style.display = 'block';
        console.log("MH openModalForEdit: display = 'block' establecido.");
        if(huespedNombreElement) { try { huespedNombreElement.focus(); } catch(e) {} }
    } else { console.error("MH openModalForEdit: modalElement inválido!"); }
}

async function handleSaveReservation(event) {
    event.preventDefault(); if (!formElement || !saveButton) return;
    saveButton.disabled = true; saveButton.textContent = 'Guardando...';
    if (formErrorElement) { formErrorElement.textContent = ''; formErrorElement.style.display = 'none'; }
    const selectedRoomOption = numeroHabSelect ? numeroHabSelect.options[numeroHabSelect.selectedIndex] : null;
    const habitacionIdValue = selectedRoomOption ? selectedRoomOption.dataset.roomId : null;
    const reservationId = resIdHiddenInput?.value ? parseInt(resIdHiddenInput.value, 10) : null;
    const reservationData = { habitacion_id: habitacionIdValue ? parseInt(habitacionIdValue, 10) : null, fecha_ingreso: checkinElement?.value || null, hora_ingreso: horaInElement?.value || config.DEFAULT_CHECKIN_TIME, fecha_salida: checkoutElement?.value || null, hora_salida: horaOutElement?.value || config.DEFAULT_CHECKOUT_TIME, estado_id: estadoSelect?.value ? parseInt(estadoSelect.value, 10) : null, huesped_nombre: huespedNombreElement?.value?.trim() || null, huesped_apellido: huespedApellidoElement?.value?.trim() || null, huesped_email: huespedEmailElement?.value?.trim() || null, huesped_telefono: huespedTelefonoElement?.value?.trim() || null, dni: huespedDniElement?.value?.trim() || null, adultos: adultosElement?.value ? parseInt(adultosElement.value, 10) : config.DEFAULT_ADULTS, menores: menoresElement?.value ? parseInt(menoresElement.value, 10) : config.DEFAULT_MINORS, precio_total: precioElement?.value ? parseFloat(precioElement.value) : null, tipo_venta_id: tipoVentaSelect?.value ? parseInt(tipoVentaSelect.value, 10) : null, canal_venta_id: canalVentaSelect?.value ? parseInt(canalVentaSelect.value, 10) : null, comentario: comentarioElement?.value?.trim() || null, patente: patenteElement?.value?.trim() || null, };
    let errors = []; // Validaciones...
    if (!reservationData.habitacion_id) errors.push("Seleccione habitación."); if (!reservationData.fecha_ingreso) errors.push("Seleccione fecha ingreso."); if (!reservationData.fecha_salida) errors.push("Seleccione fecha salida."); if (reservationData.fecha_salida <= reservationData.fecha_ingreso) errors.push("Salida debe ser posterior a ingreso."); if (!reservationData.estado_id) errors.push("Seleccione estado."); if (!reservationData.huesped_nombre) errors.push("Nombre huésped obligatorio."); if (reservationData.adultos <= 0) errors.push("Mínimo 1 adulto."); if (reservationData.menores < 0) errors.push("Menores no negativos."); if (reservationData.precio_total !== null && reservationData.precio_total < 0) errors.push("Precio no negativo."); if (reservationData.huesped_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reservationData.huesped_email)) { errors.push("Email inválido."); }
    if (errors.length > 0) { if (formErrorElement) { formErrorElement.innerHTML = errors.join('<br>'); formErrorElement.style.display = 'block'; } saveButton.disabled = false; saveButton.textContent = 'Guardar Reserva'; return; }
    try { let result; if (isEditing && reservationId) { result = await updateReservation(reservationId, reservationData); } else { result = await addReservation(reservationData); } if (result && result.success) { const actionText = (isEditing && reservationId) ? 'actualizada' : 'creada'; const displayNum = reservationData.numero_reserva || result.data?.numero_reserva || reservationId || result.data?.id || ''; alert(`¡Reserva ${displayNum} ${actionText}!`); closeModal(); window.location.reload(); } else { throw new Error(result.message || "Error API al guardar."); } }
    catch (error) { console.error("MH: Error save/update:", error); if (formErrorElement) { formErrorElement.textContent = `Error: ${error.message}`; formErrorElement.style.display = 'block'; } else { alert(`Error: ${error.message}`); } saveButton.disabled = false; saveButton.textContent = 'Guardar Reserva'; }
}

// Función para renderizar items del folio
function renderFolioItems(items = []) {
    if (!folioItems) return;
    
    folioItems.innerHTML = '';
    let saldo = 0;
    
    items.forEach(item => {
        const debito = parseFloat(item.debito) || 0;
        const pago = parseFloat(item.pago) || 0;
        saldo += debito - pago;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${new Date(item.fecha).toLocaleString()}</td>
            <td>${item.departamento}</td>
            <td>${item.detalle}</td>
            <td>${item.recibo || '-'}</td>
            <td>${item.factura || '-'}</td>
            <td class="debito">${debito ? `$${debito.toFixed(2)}` : '-'}</td>
            <td class="credito">${pago ? `$${pago.toFixed(2)}` : '-'}</td>
            <td class="saldo">$${saldo.toFixed(2)}</td>
            <td class="actions">
                <button class="edit" title="Editar" onclick="handleEditFolioItem(${item.id})">✎</button>
                <button class="delete" title="Eliminar" onclick="handleDeleteFolioItem(${item.id})">×</button>
                <button class="transfer" title="Transferir" onclick="handleTransferFolioItem(${item.id})">↪</button>
            </td>
        `;
        folioItems.appendChild(tr);
    });

    // Actualizar totales
    let totalDeb = items.reduce((sum, item) => sum + (parseFloat(item.debito) || 0), 0);
    let totalPag = items.reduce((sum, item) => sum + (parseFloat(item.pago) || 0), 0);
    
    if (totalDebito) totalDebito.textContent = `$${totalDeb.toFixed(2)}`;
    if (totalCredito) totalCredito.textContent = `$${totalPag.toFixed(2)}`;
    if (saldoFinal) saldoFinal.textContent = `$${(totalDeb - totalPag).toFixed(2)}`;
}

// --- Configuración Inicial del Modal ---
export const setupModal = async (modalTargetElement, gridElement, roomsData) => {
    console.log("MH setupModal: Iniciando..."); modalElement = modalTargetElement;
    if (!modalElement) { console.error("MH setupModal: Modal no encontrado!"); return; }
    if (Array.isArray(roomsData)) { availableRoomsData = roomsData; } else { availableRoomsData = []; }
    console.log(`MH setupModal: ${availableRoomsData.length} habs guardadas.`);

    // --- Obtener Referencias DOM ---
    overlayElement = modalElement.querySelector('.modal-overlay'); closeBtnElement = modalElement.querySelector('.modal-close-btn'); formElement = document.getElementById('reservation-form'); modalTitleElement = modalElement.querySelector('h2'); resIdHiddenInput = document.getElementById('res-id'); checkinElement = document.getElementById('res-checkin'); checkoutElement = document.getElementById('res-checkout'); nochesElement = document.getElementById('res-noches'); horaInElement = document.getElementById('res-hora-in'); horaOutElement = document.getElementById('res-hora-out'); adultosElement = document.getElementById('res-adultos'); menoresElement = document.getElementById('res-menores'); numeroReservaElement = document.getElementById('res-numero'); cancelBtnElement = document.getElementById('cancel-reservation-btn'); saveButton = document.getElementById('save-reservation-btn'); numeroHabSelect = document.getElementById('res-numero-hab-select'); tipoHabDisplay = document.getElementById('res-tipo-hab-display'); estadoSelect = document.getElementById('res-estado'); tipoVentaSelect = document.getElementById('res-tipo-venta'); canalVentaSelect = document.getElementById('res-canal'); huespedNombreElement = document.getElementById('res-nombre'); huespedApellidoElement = document.getElementById('res-apellido'); huespedEmailElement = document.getElementById('res-email'); huespedTelefonoElement = document.getElementById('res-telefono'); huespedDniElement = document.getElementById('res-dni'); precioElement = document.getElementById('res-precio'); comentarioElement = document.getElementById('res-comentario'); patenteElement = document.getElementById('res-patente'); formErrorElement = document.getElementById('reservation-form-error');

    // Obtener referencias adicionales
    btnOtrosCargos = document.getElementById('btn-otros-cargos');
    btnPagos = document.getElementById('btn-pagos');
    btnResumen = document.getElementById('btn-resumen');
    folioItems = document.getElementById('folio-items');
    totalDebito = document.getElementById('total-debito');
    totalCredito = document.getElementById('total-credito');
    saldoFinal = document.getElementById('saldo-final');

    // Verificar elementos críticos...
    const criticalElements = { formElement, saveButton, numeroHabSelect, estadoSelect, tipoVentaSelect, canalVentaSelect, resIdHiddenInput, modalTitleElement, checkinElement, checkoutElement, nochesElement, numeroReservaElement, huespedNombreElement };
    let missing = []; for(const key in criticalElements) { if(!criticalElements[key]) missing.push(key); }
    if(missing.length > 0) { console.error(`MH setupModal: Faltan elementos críticos: ${missing.join(', ')}.`); } else { console.log("MH setupModal: Elementos críticos OK."); }

    // --- Cargar Opciones para Selects ---
    try { console.log("MH: Cargando opciones..."); const [statuses, saleTypes, channels] = await Promise.all([ getOptions('statuses').catch(e=>[]), getOptions('sale_types').catch(e=>[]), getOptions('channels').catch(e=>[]) ]); loadedOptions = { statuses, sale_types: saleTypes, channels }; console.log("MH: Opciones cargadas OK."); populateOptionsSelect(estadoSelect, loadedOptions.statuses, '7', 'Estado...'); populateOptionsSelect(tipoVentaSelect, loadedOptions.sale_types, null, 'Tipo Venta...'); populateOptionsSelect(canalVentaSelect, loadedOptions.channels, null, 'Canal...'); console.log("MH: Selects poblados (Estado default: 7)."); } catch (error) { console.error("MH: Error cargando opciones:", error); }

    // --- Asignar Event Listeners ---
    if(closeBtnElement) closeBtnElement.addEventListener('click', closeModal); if(overlayElement) overlayElement.addEventListener('click', closeModal); if(cancelBtnElement) cancelBtnElement.addEventListener('click', closeModal); document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && modalElement?.style.display === 'block') { closeModal(); } }); if(checkinElement) checkinElement.addEventListener('change', updateNightsDisplay); if(checkoutElement) checkoutElement.addEventListener('change', updateNightsDisplay); if(formElement) { formElement.addEventListener('submit', handleSaveReservation); } if(numeroHabSelect) { numeroHabSelect.addEventListener('change', updateRoomTypeDisplay); }

    // --- Listener en Grid (Nuevo o Editar) ---
    if (gridElement && gridElement instanceof HTMLElement) {
        gridElement.addEventListener('click', async (event) => {
            const clickedBlock = event.target.closest('.reservation-block');
            const clickedCell = event.target.closest('.body-cell');
            console.log("MH Grid Listener: Click detectado."); // Log simplificado
            if (clickedBlock) { // EDITAR
                const reservaId = clickedBlock.dataset.reservaId; if (!reservaId) return;
                console.log(`MH Grid Listener: EDITAR ID: ${reservaId}`);
                 modalElement.style.cursor = 'wait'; try { const d = await getReservationById(reservaId); openModalForEdit(d); } catch (error) { console.error(`MH: Error get reserva ${reservaId}:`, error); alert(`Error: ${error.message}`); } finally { modalElement.style.cursor = 'default'; }
            } else if (clickedCell) { // NUEVA
                const roomNumber = clickedCell.dataset.roomNumber; const date = clickedCell.dataset.date;
                console.log(`MH Grid Listener: NUEVA -> openModalForNew(Hab: ${roomNumber}, Fecha: ${date})`);
                openModalForNew(roomNumber, date);
            }
        });
        console.log("MH setupModal: Listener de clic añadido a gridElement.");
    } else { console.error("MH setupModal: gridElement NO válido. Listener NO añadido."); }

    // Ejemplo de datos de prueba (reemplazar con datos reales de la API)
    const mockFolioItems = [
        {
            id: 1,
            fecha: '2024-01-20T14:30:00',
            departamento: 'ALJ',
            detalle: 'Noche de alojamiento',
            recibo: 'R001',
            factura: 'F001',
            debito: 15000,
            pago: 0
        },
        {
            id: 2,
            fecha: '2024-01-21T10:00:00',
            departamento: 'RST',
            detalle: 'Consumo restaurante',
            recibo: 'R002',
            factura: null,
            debito: 5000,
            pago: 0
        },
        {
            id: 3,
            fecha: '2024-01-21T16:00:00',
            departamento: 'PAG',
            detalle: 'Pago con tarjeta',
            recibo: 'R003',
            factura: null,
            debito: 0,
            pago: 20000
        }
    ];

    // Renderizar datos de prueba
    renderFolioItems(mockFolioItems);

    console.log("MH: Modal Handler configurado OK.");
}; // Fin setupModal
console.log("MH: Fin archivo modalhandler.js.");
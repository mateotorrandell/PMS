// js/main.js
// Versión que carga rooms y pasa roomData a setupModal

import { getTodayDate, addDays, formatDate } from './utils/dates.js';
import { setupGanttNavigationListeners } from './gantt/ganttnavigation.js';
import { renderGantt } from './gantt/ganttrenderer.js';
import { setupModal } from './modal/modalhandler.js'; // Importar modalhandler
import { getRoomData } from './dataservice.js';

document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Cargado. Inicializando PMS...");

    // --- Referencias DOM ---
    const ganttGrid = document.getElementById('gantt-grid');
    const datePicker = document.getElementById('date-picker');
    const reservationModal = document.getElementById('reservation-modal');
    const controlsContainer = document.querySelector('.controls');

    if (!ganttGrid || !datePicker || !reservationModal || !controlsContainer) {
        console.error("Error Crítico: Elementos DOM esenciales no encontrados."); return;
    }

    // --- Estado ---
    let currentStartDate = getTodayDate();
    let roomData = []; // Guardará los datos de habitaciones

    // --- Carga Inicial de Datos (Habitaciones) ---
    try {
        console.log("main.js: Obteniendo datos habitaciones...");
        // Esperar a que getRoomData (API call) termine
        roomData = await getRoomData();
        console.log("main.js: Datos habitaciones obtenidos:", JSON.stringify(roomData));
        if (!Array.isArray(roomData)) { roomData = []; console.warn("main.js: getRoomData no devolvió array."); }
        if (roomData.length === 0) { console.warn("main.js: No hay habitaciones configuradas."); }
    } catch (error) {
        console.error("main.js: Error CRÍTICO obteniendo datos habitaciones:", error);
        alert(`Error al cargar datos de habitaciones: ${error.message}. El Gantt/Modal puede no funcionar correctamente.`);
        roomData = []; // Continuar con array vacío
    }

    // --- Controles Navegación ---
     const controls = { /* ... botones ... */
        prevWeekBtn: controlsContainer.querySelector('#prev-week'),
        prevDayBtn: controlsContainer.querySelector('#prev-day'),
        todayBtn: controlsContainer.querySelector('#today'),
        nextDayBtn: controlsContainer.querySelector('#next-day'),
        nextWeekBtn: controlsContainer.querySelector('#next-week')
     };

    // --- Lógica Navegación ---
    function handleNavigation(action) { /* ... como antes ... */
        let newStartDate = new Date(currentStartDate);
        const currentMs = currentStartDate.getTime();
        switch(action) {
            case 'today': newStartDate = getTodayDate(); break;
            case 'prevDay': newStartDate = addDays(currentStartDate, -1); break;
            case 'nextDay': newStartDate = addDays(currentStartDate, 1); break;
            case 'prevWeek': newStartDate = addDays(currentStartDate, -7); break;
            case 'nextWeek': newStartDate = addDays(currentStartDate, 7); break;
            default: if(typeof action==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(action)){try{const p=action.split('-').map(Number);newStartDate=new Date(Date.UTC(p[0],p[1]-1,p[2]));if(isNaN(newStartDate))throw new Error();}catch(e){newStartDate=getTodayDate();}}else{newStartDate=currentStartDate;}break;
        }
        if (newStartDate && newStartDate.getTime() !== currentMs) {
            currentStartDate = newStartDate;
            if(ganttGrid && datePicker) renderGantt(ganttGrid, currentStartDate, datePicker, roomData);
        } else if (action === 'today' && datePicker && datePicker.value !== formatDate(currentStartDate)) {
             if(ganttGrid) renderGantt(ganttGrid, currentStartDate, datePicker, roomData);
        }
    }

    // --- Inicialización Final ---
    try {
        console.log("main.js: Configurando listeners y render inicial...");
        if (datePicker) {
             setupGanttNavigationListeners(controls, datePicker, handleNavigation);
        } else { console.warn("main.js: DatePicker no encontrado."); }

        // ** Pasar roomData (cargado arriba) a setupModal **
        if (reservationModal && ganttGrid) {
            // Ahora setupModal recibe roomData para poder poblar el select de habitación
            setupModal(reservationModal, ganttGrid, roomData); // <= PASAR roomData
        } else { console.warn("main.js: Modal o Grid no encontrados para setupModal."); }

        console.log(`main.js: Render inicial Gantt con fecha: ${formatDate(currentStartDate)} y ${roomData.length} habitaciones.`);
        if (ganttGrid && datePicker) {
            renderGantt(ganttGrid, currentStartDate, datePicker, roomData); // Render inicial usa roomData
        } else { console.error("main.js: GanttGrid o DatePicker no encontrados para render inicial."); }

        console.log("main.js: PMS Gantt Inicializado Correctamente.");
    } catch (error) {
        console.error("main.js: Error durante la inicialización final:", error);
        alert("Error fatal al inicializar la aplicación. Revise la consola.");
    }

    const folioBtn = document.getElementById("folio-btn");
    const folioModal = document.getElementById("folio-modal");
    const folioCloseBtn = folioModal.querySelector(".modal-close-btn");
    const folioCancelBtn = document.getElementById("cancel-folio-btn");
    const addCargoBtn = document.getElementById("add-cargo-btn");
    const folioForm = document.getElementById("folio-form");
    const folioCargosList = document.getElementById("folio-cargos-list");

    // Open Folio Modal
    folioBtn.addEventListener("click", () => {
        const numeroReserva = document.getElementById("res-numero").textContent.trim();
        document.getElementById("folio-reserva-numero").value = numeroReserva;

        // Clear previous cargos and load existing ones
        folioCargosList.innerHTML = "<p>Cargando cargos...</p>";
        fetch(`/api/folio_cargos?numero_reserva=${numeroReserva}`)
            .then((response) => response.json())
            .then((data) => {
                folioCargosList.innerHTML = "";
                data.forEach((cargo) => {
                    const cargoItem = document.createElement("div");
                    cargoItem.classList.add("cargo-item");
                    cargoItem.innerHTML = `
                        <span class="cargo-description">${cargo.descripcion}</span>
                        <span class="cargo-monto">${cargo.monto.toFixed(2)} ARS</span>
                        <div class="cargo-actions">
                            <button data-id="${cargo.id}" class="delete-cargo-btn">✖</button>
                        </div>
                    `;
                    folioCargosList.appendChild(cargoItem);
                });
            })
            .catch(() => {
                folioCargosList.innerHTML = "<p>Error al cargar los cargos.</p>";
            });

        folioModal.style.display = "block";
    });

    // Close Folio Modal
    const closeFolioModal = () => {
        folioModal.style.display = "none";
    };
    folioCloseBtn.addEventListener("click", closeFolioModal);
    folioCancelBtn.addEventListener("click", closeFolioModal);

    // Add New Cargo
    addCargoBtn.addEventListener("click", () => {
        const descripcion = document.getElementById("folio-descripcion").value.trim();
        const monto = parseFloat(document.getElementById("folio-monto").value);
        const tipo = document.getElementById("folio-tipo").value;

        if (!descripcion || isNaN(monto) || monto <= 0) {
            alert("Por favor, complete todos los campos correctamente.");
            return;
        }

        const cargoItem = document.createElement("div");
        cargoItem.classList.add("cargo-item");
        cargoItem.innerHTML = `
            <span class="cargo-description">${descripcion}</span>
            <span class="cargo-monto">${monto.toFixed(2)} ARS</span>
            <div class="cargo-actions">
                <button class="delete-cargo-btn">✖</button>
            </div>
        `;
        folioCargosList.appendChild(cargoItem);

        // Clear input fields
        document.getElementById("folio-descripcion").value = "";
        document.getElementById("folio-monto").value = "";
        document.getElementById("folio-tipo").value = "cargo";
    });

    // Save Folio
    folioForm.addEventListener("submit", (e) => {
        e.preventDefault();

        const numeroReserva = document.getElementById("folio-reserva-numero").value;
        const cargos = Array.from(folioCargosList.querySelectorAll(".cargo-item")).map((item) => {
            return {
                descripcion: item.querySelector(".cargo-description").textContent.trim(),
                monto: parseFloat(item.querySelector(".cargo-monto").textContent),
                tipo: "cargo", // Default to "cargo" for now
            };
        });

        fetch("/api/folio_cargos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ numero_reserva: numeroReserva, cargos }),
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.success) {
                    alert("Folio guardado exitosamente.");
                    closeFolioModal();
                } else {
                    alert("Error al guardar el folio.");
                }
            })
            .catch(() => {
                alert("Error al guardar el folio.");
            });
    });

    // Delete Cargo
    folioCargosList.addEventListener("click", (e) => {
        if (e.target.classList.contains("delete-cargo-btn")) {
            const cargoItem = e.target.closest(".cargo-item");
            cargoItem.remove();
        }
    });
}); // Fin DOMContentLoaded
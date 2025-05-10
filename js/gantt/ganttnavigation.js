// js/gantt/ganttNavigation.js

/**
 * Configura los event listeners para los controles de navegación del Gantt.
 * @param {object} controls - Objeto con referencias a los botones (todayBtn, prevDayBtn, etc.).
 * @param {HTMLElement} datePickerElement - El input de fecha.
 * @param {function} navigationCallback - Función a llamar cuando ocurre un evento de navegación.
 * Recibe como argumento: 'prevWeek', 'prevDay', 'today', 'nextDay', 'nextWeek', o una fecha 'YYYY-MM-DD'.
 */
export function setupGanttNavigationListeners(controls, datePickerElement, navigationCallback) {
    // Validar argumentos principales
    if (!controls || !datePickerElement || typeof navigationCallback !== 'function') {
        console.error("Error Interno: Faltan argumentos para setupGanttNavigationListeners.");
        // Podríamos lanzar un error o simplemente no añadir listeners
        return;
    }

    // --- Añadir Listeners verificando cada botón ---
    if (controls.prevWeekBtn) {
        controls.prevWeekBtn.addEventListener('click', () => navigationCallback('prevWeek'));
    } else {
        console.warn("Botón 'prevWeekBtn' no encontrado.");
    }

    if (controls.prevDayBtn) {
        controls.prevDayBtn.addEventListener('click', () => navigationCallback('prevDay'));
    } else {
        console.warn("Botón 'prevDayBtn' no encontrado.");
    }

    if (controls.todayBtn) {
        controls.todayBtn.addEventListener('click', () => navigationCallback('today'));
    } else {
        console.warn("Botón 'todayBtn' no encontrado.");
    }

    if (controls.nextDayBtn) {
        controls.nextDayBtn.addEventListener('click', () => navigationCallback('nextDay'));
    } else {
        console.warn("Botón 'nextDayBtn' no encontrado.");
    }

    if (controls.nextWeekBtn) {
        controls.nextWeekBtn.addEventListener('click', () => navigationCallback('nextWeek'));
    } else {
        console.warn("Botón 'nextWeekBtn' no encontrado.");
    }

    // Listener para el Date Picker
    datePickerElement.addEventListener('change', (event) => {
        const selectedDate = event.target.value;
        // Validar que sea una fecha en formato YYYY-MM-DD
        if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
            // Validar si la fecha parseada es realmente válida (evita ej: 2023-02-30)
            const dateObj = new Date(selectedDate + 'T00:00:00Z'); // Usar Z para UTC
            if (!isNaN(dateObj.getTime())) {
                 navigationCallback(selectedDate); // Pasar el string YYYY-MM-DD
            } else {
                 console.warn("Fecha inválida seleccionada en el picker (ej: día inexistente):", selectedDate);
                 navigationCallback('today'); // Revertir a hoy si es inválida
            }
        } else {
            console.warn("Formato de fecha inválido o vacío en el picker, revirtiendo a hoy.");
            navigationCallback('today'); // Revertir a hoy si es inválido o se borra
        }
    });

    console.log("Listeners de navegación configurados."); // Mensaje de éxito
}
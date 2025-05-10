// js/utils/dates.js

/**
 * Obtiene la fecha de hoy como objeto Date (normalizada a medianoche).
 * @returns {Date} Fecha de hoy a las 00:00:00.
 */
export function getTodayDate() {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a medianoche
    return today;
}

/**
 * Formatea un objeto Date a un string en formato YYYY-MM-DD.
 * @param {Date} date - El objeto Date a formatear.
 * @returns {string} Fecha formateada.
 */
export function formatDate(date) {
    if (!(date instanceof Date) || isNaN(date)) {
        // console.error("Invalid date passed to formatDate:", date);
        return ''; // O manejar el error como prefieras
    }
    try {
       return date.toISOString().split('T')[0];
    } catch (e) {
        console.error("Error formatting date:", date, e);
        return '';
    }
}

/**
 * Formatea un objeto Date para mostrar en cabecera (ej: "Lun 03/05").
 * Intenta usar la configuración regional del navegador.
 * @param {Date} date - El objeto Date a formatear.
 * @returns {string} Fecha formateada para cabecera.
 */
export function formatHeaderDate(date) {
     if (!(date instanceof Date) || isNaN(date)) return '';
    const options = { weekday: 'short', day: '2-digit', month: '2-digit' };
    try {
        // Usar 'es-ES' como fallback si el idioma del navegador no está disponible o falla
        return date.toLocaleDateString(navigator.language || 'es-ES', options);
    } catch (e) {
        // Fallback simple si falla la localización
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const weekday = weekdays[date.getDay()];
        return `${weekday} ${day}/${month}`;
    }
}

/**
 * Añade un número de días a una fecha dada.
 * @param {Date} date - La fecha inicial.
 * @param {number} days - Número de días a añadir (puede ser negativo).
 * @returns {Date} Nueva fecha con los días añadidos.
 */
export function addDays(date, days) {
    if (!(date instanceof Date) || isNaN(date)) return new Date(NaN); // Devuelve fecha inválida
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

/**
 * Calcula la diferencia en días completos entre dos fechas YYYY-MM-DD.
 * @param {string} startDateStr - Fecha de inicio (YYYY-MM-DD).
 * @param {string} endDateStr - Fecha de fin (YYYY-MM-DD).
 * @returns {number} Número de noches (días completos) o 0 si las fechas son inválidas o fin <= inicio.
 */
export function calculateDaysBetween(startDateStr, endDateStr) {
    if (!startDateStr || !endDateStr) {
        return 0;
    }
    try {
        // Usar T00:00:00Z para asegurar que se interpreta como UTC y evitar problemas de DST/zona horaria al calcular diferencias de días completos.
        const start = new Date(startDateStr + 'T00:00:00Z');
        const end = new Date(endDateStr + 'T00:00:00Z');

        // Validar fechas después de la conversión
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
             console.warn("Invalid date strings for calculation:", startDateStr, endDateStr);
             return 0;
        }

        if (end > start) {
            const timeDiff = end.getTime() - start.getTime();
            // Dividir por milisegundos en un día y redondear hacia arriba (ceil) o usar round/floor según definición exacta de 'noches'
            // Generalmente Math.ceil(diff / (1000 * 3600 * 24)) funciona para la cuenta de noches.
            // Ejemplo: sale el día 5, entra el día 3 -> 5-3 = 2 noches.
            // (getTime de dia 5 Z - getTime de dia 3 Z) / ms_por_dia = 2
             return Math.round(timeDiff / (1000 * 3600 * 24)); // Usar round para evitar errores por milisegundos residuales
        } else {
            return 0; // Check-out debe ser después del Check-in
        }
    } catch (e) {
         console.error("Error calculating days between:", e);
         return 0;
    }
}
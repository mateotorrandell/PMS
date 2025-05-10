// js/configuracion_opciones.js
// Lógica para la página de gestión de opciones de reserva

// Importar funciones del dataService (¡asegúrate que dataService.js esté actualizado!)
import { getOptions, addOption, deleteOption } from './dataservice.js';

// --- Configuración de las Secciones ---
// Define la estructura y los IDs asociados a cada tipo de opción
const sections = {
    sale_types: {
        title: "Tipos de Venta", // Título para mensajes
        formId: 'form-sale_types',
        listId: 'list-sale_types',
        errorDisplayId: 'error-sale_types', // ID del div para errores de sección
        nameInputId: 'name-sale_types',
        hasColor: false,
        data: [] // Array para almacenar los datos cargados
    },
    channels: {
        title: "Canales de Venta",
        formId: 'form-channels',
        listId: 'list-channels',
        errorDisplayId: 'error-channels',
        nameInputId: 'name-channels',
        hasColor: false,
        data: []
    },
    statuses: {
        title: "Estados de Reserva",
        formId: 'form-statuses',
        listId: 'list-statuses',
        errorDisplayId: 'error-statuses',
        nameInputId: 'name-statuses',
        colorInputId: 'color-statuses', // ID específico para input de color
        hasColor: true,
        data: []
    }
};

// --- Funciones de UI ---

/** Muestra mensaje de carga en una lista específica */
function showListLoading(type) {
    const listElement = document.getElementById(sections[type].listId);
    if (listElement) listElement.innerHTML = '<li><em style="color:#666;">Cargando...</em></li>';
}

/** Muestra un mensaje de error general para una sección */
function showSectionError(type, message) {
    const errorElement = document.getElementById(sections[type].errorDisplayId);
    if (errorElement) {
        errorElement.textContent = message || 'Ocurrió un error.';
        errorElement.style.display = 'block';
    }
    // También limpiar la lista para evitar confusión
    const listElement = document.getElementById(sections[type].listId);
    if (listElement) listElement.innerHTML = '<li>Error al cargar datos.</li>';
}

/** Oculta el mensaje de error de una sección */
function clearSectionError(type) {
     const errorElement = document.getElementById(sections[type].errorDisplayId);
     if (errorElement) {
         errorElement.textContent = '';
         errorElement.style.display = 'none';
     }
}

/** Deshabilita/habilita un formulario específico */
function disableSectionForm(type, disabled = true) {
    const form = document.getElementById(sections[type].formId);
    if (!form) return;
    const button = form.querySelector('button[type="submit"]');
    const inputs = form.querySelectorAll('input');

    if (button) {
        button.disabled = disabled;
        button.textContent = disabled ? 'Añadiendo...' : 'Añadir';
    }
    inputs.forEach(input => input.disabled = disabled);
}

/** Renderiza la lista de opciones para un tipo específico */
function renderList(type) {
    const config = sections[type];
    const listElement = document.getElementById(config.listId);
    if (!listElement) {
        console.error(`Elemento lista ${config.listId} no encontrado.`);
        return;
    }

    clearSectionError(type); // Limpiar errores previos de la sección
    listElement.innerHTML = ''; // Limpiar lista actual

    // Ordenar alfabéticamente por nombre para mostrar
    const items = [...config.data].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', {sensitivity: 'base'}));

    if (items.length === 0) {
        listElement.innerHTML = '<li>No hay opciones configuradas.</li>';
        return;
    }

    items.forEach(item => {
         // Validar objeto mínimo antes de intentar renderizar
         if (!item || typeof item.id === 'undefined' || typeof item.nombre === 'undefined' || (config.hasColor && typeof item.color === 'undefined')) {
             console.warn(`Elemento inválido encontrado en datos tipo "${type}":`, item);
             return; // Saltar este elemento inválido
         }

        const li = document.createElement('li');
        li.dataset.id = item.id; // Guardar ID para operaciones

        const itemInfo = document.createElement('div');
        itemInfo.classList.add('item-info');

        // Muestra de color (si aplica)
        if (config.hasColor) {
            const colorSwatch = document.createElement('span');
            colorSwatch.classList.add('item-color-swatch');
            colorSwatch.style.backgroundColor = item.color;
            colorSwatch.title = `Color: ${item.color}`;
            itemInfo.appendChild(colorSwatch);
        }

        // Nombre
        const nameSpan = document.createElement('span');
        nameSpan.classList.add('item-name');
        nameSpan.textContent = item.nombre; // API devuelve 'nombre'
        itemInfo.appendChild(nameSpan);

        // Acciones (botón eliminar)
        const itemActions = document.createElement('div');
        itemActions.classList.add('item-actions');
        const deleteButton = document.createElement('button');
        deleteButton.innerHTML = '&times;'; // Icono 'x'
        deleteButton.title = `Eliminar "${item.nombre}"`;
        deleteButton.dataset.itemId = item.id; // Guardar ID en el botón
        deleteButton.dataset.itemType = type; // Guardar tipo en el botón

        // Añadir listener directamente (se podría usar delegación si hay muchos items)
        deleteButton.addEventListener('click', (e) => {
             e.currentTarget.disabled = true; // Deshabilitar botón
             handleDelete(type, item.id).finally(() => {
                 // Intentar rehabilitar (puede fallar si ya no existe)
                 try { e.currentTarget.disabled = false; } catch(err){}
             });
        });

        itemActions.appendChild(deleteButton);

        li.appendChild(itemInfo);
        li.appendChild(itemActions);
        listElement.appendChild(li);
    });
}

// --- Funciones de Manejo de Datos ---

/** Carga y renderiza todas las listas de opciones al iniciar */
async function loadAllOptions() {
    console.log("Cargando todas las opciones...");
    // Usar Promise.all para cargar en paralelo
    const promises = Object.keys(sections).map(async (type) => {
        showListLoading(type); // Mostrar 'Cargando...' en cada lista
        try {
            const optionsData = await getOptions(type); // Llama a dataService.js
            if (Array.isArray(optionsData)) {
                sections[type].data = optionsData; // Guardar datos en el estado local
                renderList(type); // Renderizar la lista específica
            } else {
                 throw new Error("La respuesta de la API no fue un array.");
            }
        } catch (error) {
            console.error(`Error al cargar opciones tipo "${type}":`, error);
            showSectionError(type, error.message); // Mostrar error en la sección
            sections[type].data = []; // Asegurar que sea un array vacío en caso de error
        }
    });

    await Promise.all(promises); // Esperar a que todas las cargas terminen
     console.log("Carga inicial de opciones completada (con posibles errores individuales).");
}

/** Maneja el evento submit de los formularios para añadir opciones */
async function handleAdd(event) {
    event.preventDefault();
    const form = event.target;
    const type = form.elements['type'].value; // Obtener tipo desde input oculto
    if (!type || !sections[type]) {
        console.error("Tipo inválido en formulario:", type);
        return;
    }

    const config = sections[type];
    const nameInput = document.getElementById(config.nameInputId);
    const name = nameInput?.value.trim();
    let color = null;
    const dataToSend = { nombre: name }; // API espera 'nombre'

    if (!name) { alert('El nombre no puede estar vacío.'); nameInput?.focus(); return; }

    if (config.hasColor) {
        const colorInput = document.getElementById(config.colorInputId);
        color = colorInput?.value;
        if (!color) { alert('Debe seleccionar un color.'); colorInput?.focus(); return; }
        dataToSend.color = color; // API espera 'color'
    }

    disableSectionForm(type, true); // Deshabilitar form específico

    try {
        const addedResponse = await addOption(type, dataToSend); // Llama a dataService.js

        if (addedResponse.success && addedResponse.data) {
            // Añadir al estado local y re-renderizar
            sections[type].data.push(addedResponse.data);
            renderList(type);
            // Limpiar formulario
            form.reset(); // Resetear todo el form
             if (config.hasColor) { document.getElementById(config.colorInputId).value = '#cccccc'; } // Resetear color picker si existe
             nameInput?.focus(); // Foco en nombre para siguiente entrada
        } else {
            // Si success es false, la API debería haber enviado un 'message'
            throw new Error(addedResponse.message || "La API no confirmó la adición.");
        }
    } catch (error) {
        console.error(`Error al añadir opción tipo "${type}":`, error);
        alert(`Error al añadir ${config.title}: ${error.message}`); // Mostrar error al usuario
        nameInput?.focus(); // Devolver foco al input de nombre
    } finally {
        disableSectionForm(type, false); // Rehabilitar form específico
    }
}

/** Maneja el evento click para eliminar una opción */
async function handleDelete(type, id) {
    const config = sections[type];
    const itemToDelete = config.data.find(item => item.id == id);

    if (!itemToDelete) {
        console.warn(`Intento de eliminar item no encontrado localmente: Tipo=${type}, ID=${id}`);
        return; // Seguridad
    }

    if (confirm(`¿Estás seguro de eliminar "${itemToDelete.nombre}" de ${config.title}?`)) {
        try {
            await deleteOption(type, id); // Llama a dataService.js
            // Actualizar estado local filtrando el eliminado
            sections[type].data = sections[type].data.filter(item => item.id != id);
            renderList(type); // Re-renderizar la lista afectada
        } catch (error) {
            console.error(`Error al eliminar opción tipo "${type}" (ID: ${id}):`, error);
            alert(`Error al eliminar: ${error.message}`);
            // No se re-renderiza si hubo error para no perder contexto
        }
    }
    // El botón se rehabilita en el listener que llamó a esta función
}

// --- Inicialización de la Página ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM cargado para configuración de opciones.");
    // Asignar listeners a todos los formularios
    for (const type in sections) {
        const form = document.getElementById(sections[type].formId);
        if (form) {
            // Pasar el tipo ('sale_types', 'channels', 'statuses') a handleAdd
            form.addEventListener('submit', (event) => handleAdd(event)); // handleAdd obtendrá el tipo del input oculto
        } else {
            console.error(`Formulario ${sections[type].formId} no encontrado.`);
        }
    }
    // Cargar todas las opciones al iniciar la página
    loadAllOptions();
});
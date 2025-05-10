// js/departamentos.js - Lógica para gestionar departamentos

document.addEventListener("DOMContentLoaded", () => {
  // Referencias a elementos del DOM
  const departamentosTree = document.getElementById("departamentos-tree")
  const loadingIndicator = document.getElementById("loading-indicator")
  const noResults = document.getElementById("no-results")
  const searchInput = document.getElementById("search-input")
  const searchBtn = document.getElementById("search-btn")
  const newDepartamentoBtn = document.getElementById("new-departamento-btn")
  const departamentoForm = document.getElementById("departamento-form")
  const formTitle = document.getElementById("form-title")
  const departamentoIdInput = document.getElementById("departamento-id")
  const codigoInput = document.getElementById("codigo")
  const nombreInput = document.getElementById("nombre")
  const descripcionInput = document.getElementById("descripcion")
  const departamentoPadreSelect = document.getElementById("departamento-padre")
  const ordenInput = document.getElementById("orden")
  const activoCheckbox = document.getElementById("activo")
  const saveBtn = document.getElementById("save-btn")
  const cancelBtn = document.getElementById("cancel-btn")
  const formError = document.getElementById("form-error")
  const confirmModal = document.getElementById("confirm-modal")
  const confirmMessage = document.getElementById("confirm-message")
  const confirmYesBtn = document.getElementById("confirm-yes")
  const confirmNoBtn = document.getElementById("confirm-no")

  // Estado de la aplicación
  let departamentos = []
  let departamentoToDelete = null
  let isEditing = false
  let searchTerm = ""

  // Configuración de API
  const API_URL = "/api/departamentos.php"

  // Inicialización
  init()

  // Función de inicialización
  function init() {
    // Cargar departamentos
    loadDepartamentos()

    // Event listeners
    setupEventListeners()
  }

  // Configurar event listeners
  function setupEventListeners() {
    // Búsqueda
    searchBtn.addEventListener("click", handleSearch)
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        handleSearch()
      }
    })

    // Formulario
    newDepartamentoBtn.addEventListener("click", handleNewDepartamento)
    departamentoForm.addEventListener("submit", handleSaveDepartamento)
    cancelBtn.addEventListener("click", resetForm)

    // Modal de confirmación
    confirmYesBtn.addEventListener("click", confirmDelete)
    confirmNoBtn.addEventListener("click", closeConfirmModal)
  }

  // Cargar departamentos desde la API
  async function loadDepartamentos() {
    try {
      showLoading(true)

      const response = await fetch(API_URL)
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        departamentos = result.data || []
        renderDepartamentos()
        populateDepartamentoPadreSelect()
      } else {
        showError("Error al cargar departamentos: " + result.message)
      }
    } catch (error) {
      console.error("Error al cargar departamentos:", error)
      showError("Error al cargar departamentos: " + error.message)
    } finally {
      showLoading(false)
    }
  }

  // Renderizar departamentos en el árbol
  function renderDepartamentos() {
    // Limpiar contenedor
    departamentosTree.innerHTML = ""

    // Filtrar por término de búsqueda si existe
    let filteredDepartamentos = departamentos
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filteredDepartamentos = departamentos.filter(
        (d) =>
          d.nombre.toLowerCase().includes(term) ||
          d.codigo.toLowerCase().includes(term) ||
          (d.descripcion && d.descripcion.toLowerCase().includes(term)),
      )
    }

    // Mostrar mensaje si no hay resultados
    if (filteredDepartamentos.length === 0) {
      noResults.style.display = "block"
      return
    }

    noResults.style.display = "none"

    // Organizar departamentos en estructura jerárquica
    const departamentosMap = {}
    filteredDepartamentos.forEach((d) => {
      departamentosMap[d.id] = { ...d, children: [] }
    })

    const rootDepartamentos = []

    filteredDepartamentos.forEach((d) => {
      if (d.departamento_padre_id) {
        if (departamentosMap[d.departamento_padre_id]) {
          departamentosMap[d.departamento_padre_id].children.push(departamentosMap[d.id])
        } else {
          rootDepartamentos.push(departamentosMap[d.id])
        }
      } else {
        rootDepartamentos.push(departamentosMap[d.id])
      }
    })

    // Renderizar departamentos raíz
    rootDepartamentos.forEach((d) => {
      departamentosTree.appendChild(createDepartamentoElement(d))
    })
  }

  // Crear elemento HTML para un departamento
  function createDepartamentoElement(departamento) {
    const treeItem = document.createElement("div")
    treeItem.className = "tree-item tree-parent"

    const itemContent = document.createElement("div")
    itemContent.className = `tree-item-content ${departamento.activo == 1 ? "" : "inactive"}`

    const itemInfo = document.createElement("div")
    itemInfo.className = "tree-item-info"

    const itemTitle = document.createElement("div")
    itemTitle.className = "tree-item-title"

    const itemCode = document.createElement("span")
    itemCode.className = "tree-item-code"
    itemCode.textContent = departamento.codigo

    itemTitle.appendChild(itemCode)
    itemTitle.appendChild(document.createTextNode(departamento.nombre))

    const itemSubtitle = document.createElement("div")
    itemSubtitle.className = "tree-item-subtitle"
    itemSubtitle.textContent = departamento.descripcion || "Sin descripción"

    itemInfo.appendChild(itemTitle)
    itemInfo.appendChild(itemSubtitle)

    const itemActions = document.createElement("div")
    itemActions.className = "tree-item-actions"

    const editBtn = document.createElement("button")
    editBtn.className = "tree-item-btn edit"
    editBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>'
    editBtn.title = "Editar"
    editBtn.addEventListener("click", () => handleEditDepartamento(departamento))

    const deleteBtn = document.createElement("button")
    deleteBtn.className = "tree-item-btn delete"
    deleteBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>'
    deleteBtn.title = "Eliminar"
    deleteBtn.addEventListener("click", () => handleDeleteDepartamento(departamento))

    itemActions.appendChild(editBtn)
    itemActions.appendChild(deleteBtn)

    itemContent.appendChild(itemInfo)
    itemContent.appendChild(itemActions)

    treeItem.appendChild(itemContent)

    // Renderizar hijos si existen
    if (departamento.children && departamento.children.length > 0) {
      const childrenContainer = document.createElement("div")
      childrenContainer.className = "tree-children"

      departamento.children.forEach((child) => {
        childrenContainer.appendChild(createDepartamentoElement(child))
      })

      treeItem.appendChild(childrenContainer)
    }

    return treeItem
  }

  // Poblar select de departamento padre
  function populateDepartamentoPadreSelect() {
    // Guardar valor actual
    const currentValue = departamentoPadreSelect.value

    // Limpiar opciones existentes excepto la primera
    while (departamentoPadreSelect.options.length > 1) {
      departamentoPadreSelect.remove(1)
    }

    // Añadir departamentos como opciones
    departamentos.forEach((d) => {
      // Si estamos editando, no incluir el departamento actual ni sus hijos
      if (isEditing && departamentoIdInput.value) {
        const currentId = Number.parseInt(departamentoIdInput.value)
        if (d.id === currentId || isDescendantOf(d, currentId)) {
          return
        }
      }

      const option = document.createElement("option")
      option.value = d.id
      option.textContent = `${d.codigo} - ${d.nombre}`
      departamentoPadreSelect.appendChild(option)
    })

    // Restaurar valor si existe
    if (currentValue && departamentoPadreSelect.querySelector(`option[value="${currentValue}"]`)) {
      departamentoPadreSelect.value = currentValue
    }
  }

  // Verificar si un departamento es descendiente de otro
  function isDescendantOf(departamento, ancestorId) {
    let current = departamento
    while (current.departamento_padre_id) {
      if (Number.parseInt(current.departamento_padre_id) === ancestorId) {
        return true
      }

      current = departamentos.find((d) => d.id === Number.parseInt(current.departamento_padre_id))
      if (!current) break
    }

    return false
  }

  // Manejar búsqueda
  function handleSearch() {
    searchTerm = searchInput.value.trim()
    renderDepartamentos()
  }

  // Manejar nuevo departamento
  function handleNewDepartamento() {
    resetForm()
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Manejar edición de departamento
  function handleEditDepartamento(departamento) {
    isEditing = true
    formTitle.textContent = `Editar Departamento: ${departamento.codigo}`

    departamentoIdInput.value = departamento.id
    codigoInput.value = departamento.codigo
    nombreInput.value = departamento.nombre
    descripcionInput.value = departamento.descripcion || ""
    departamentoPadreSelect.value = departamento.departamento_padre_id || ""
    ordenInput.value = departamento.orden
    activoCheckbox.checked = departamento.activo == 1

    // Actualizar select de departamento padre para evitar ciclos
    populateDepartamentoPadreSelect()

    // Scroll al formulario
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Manejar eliminación de departamento
  function handleDeleteDepartamento(departamento) {
    departamentoToDelete = departamento
    confirmMessage.textContent = `¿Está seguro que desea eliminar el departamento "${departamento.codigo} - ${departamento.nombre}"?`
    openConfirmModal()
  }

  // Confirmar eliminación
  async function confirmDelete() {
    if (!departamentoToDelete) return

    try {
      showLoading(true)
      closeConfirmModal()

      const response = await fetch(`${API_URL}?id=${departamentoToDelete.id}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (result.success) {
        // Recargar departamentos
        await loadDepartamentos()
        showNotification("Departamento eliminado correctamente")
      } else {
        showError("Error al eliminar departamento: " + result.message)
      }
    } catch (error) {
      console.error("Error al eliminar departamento:", error)
      showError("Error al eliminar departamento: " + error.message)
    } finally {
      showLoading(false)
      departamentoToDelete = null
    }
  }

  // Manejar guardado de departamento
  async function handleSaveDepartamento(event) {
    event.preventDefault()

    // Validar formulario
    if (!validateForm()) {
      return
    }

    try {
      showLoading(true)
      hideFormError()

      // Preparar datos
      const departamentoData = {
        codigo: codigoInput.value.trim().toUpperCase(),
        nombre: nombreInput.value.trim(),
        descripcion: descripcionInput.value.trim(),
        departamento_padre_id: departamentoPadreSelect.value || null,
        orden: Number.parseInt(ordenInput.value) || 0,
        activo: activoCheckbox.checked ? 1 : 0,
      }

      let url = API_URL
      let method = "POST"

      // Si estamos editando
      if (isEditing && departamentoIdInput.value) {
        url = `${API_URL}?id=${departamentoIdInput.value}`
        method = "PUT"
      }

      const response = await fetch(url, {
        method: method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(departamentoData),
      })

      const result = await response.json()

      if (result.success) {
        // Recargar departamentos
        await loadDepartamentos()
        resetForm()
        showNotification(isEditing ? "Departamento actualizado correctamente" : "Departamento creado correctamente")
      } else {
        showFormError(result.message)
      }
    } catch (error) {
      console.error("Error al guardar departamento:", error)
      showFormError("Error al guardar departamento: " + error.message)
    } finally {
      showLoading(false)
    }
  }

  // Validar formulario
  function validateForm() {
    hideFormError()

    // Validar código
    const codigo = codigoInput.value.trim()
    if (!codigo) {
      showFormError("El código es obligatorio")
      codigoInput.focus()
      return false
    }

    if (!/^[A-Za-z0-9]{1,10}$/.test(codigo)) {
      showFormError("El código debe ser alfanumérico y tener máximo 10 caracteres")
      codigoInput.focus()
      return false
    }

    // Validar nombre
    const nombre = nombreInput.value.trim()
    if (!nombre) {
      showFormError("El nombre es obligatorio")
      nombreInput.focus()
      return false
    }

    return true
  }

  // Resetear formulario
  function resetForm() {
    departamentoForm.reset()
    departamentoIdInput.value = ""
    formTitle.textContent = "Nuevo Departamento"
    hideFormError()
    isEditing = false

    // Actualizar select de departamento padre
    populateDepartamentoPadreSelect()
  }

  // Mostrar error en el formulario
  function showFormError(message) {
    formError.textContent = message
    formError.style.display = "block"
  }

  // Ocultar error en el formulario
  function hideFormError() {
    formError.textContent = ""
    formError.style.display = "none"
  }

  // Mostrar notificación
  function showNotification(message) {
    // Implementar según necesidades (puede ser un toast, alert, etc.)
    alert(message)
  }

  // Mostrar error general
  function showError(message) {
    console.error(message)
    alert("Error: " + message)
  }

  // Mostrar/ocultar indicador de carga
  function showLoading(show) {
    loadingIndicator.style.display = show ? "flex" : "none"
  }

  // Abrir modal de confirmación
  function openConfirmModal() {
    confirmModal.style.display = "flex"
  }

  // Cerrar modal de confirmación
  function closeConfirmModal() {
    confirmModal.style.display = "none"
  }
})

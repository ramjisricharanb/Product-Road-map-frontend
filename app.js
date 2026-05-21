const API_BASE_URL = getApiBaseUrl();
const statusOptions = [
  "Product",
  "Design",
  "Development",
  "Testing",
  "Deployed",
  "On Hold",
];

let tasks = [];
let editingTaskId = null;
let selectedStatuses = [];
let selectedPriorities = [];
let currentPage = 1;
let pageSize = 15;
let selectedTaskIds = new Set();
let globalTooltip = null;

function getApiBaseUrl() {
  const { hostname } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return "http://localhost:4000/api";
  }

  return "https://api.nconnect.co.in/api";
}

const statsGrid = document.getElementById("statsGrid");
const taskTableBody = document.getElementById("taskTableBody");
const taskCountLabel = document.getElementById("taskCountLabel");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const priorityFilter = document.getElementById("priorityFilter");
const exportButton = document.getElementById("exportButton");
const resetFiltersButton = document.getElementById("resetFiltersButton");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const paginationInfo = document.getElementById("paginationInfo");
const previousPageButton = document.getElementById("previousPageButton");
const nextPageButton = document.getElementById("nextPageButton");
const openModalButton = document.getElementById("openModalButton");
const closeModalButton = document.getElementById("closeModalButton");
const cancelButton = document.getElementById("cancelButton");
const taskModal = document.getElementById("taskModal");
const taskForm = document.getElementById("taskForm");
const modalTitle = document.getElementById("modalTitle");

initializeDashboard();

function initializeDashboard() {
  searchInput.addEventListener("input", () => {
    currentPage = 1;
    renderDashboard();
  });
  exportButton.addEventListener("click", exportFilteredTasks);
  resetFiltersButton.addEventListener("click", resetFilters);
  pageSizeSelect.addEventListener("change", handlePageSizeChange);
  previousPageButton.addEventListener("click", goToPreviousPage);
  nextPageButton.addEventListener("click", goToNextPage);
  openModalButton.addEventListener("click", () => openModal());
  closeModalButton.addEventListener("click", closeModal);
  cancelButton.addEventListener("click", closeModal);
  taskModal.addEventListener("click", (event) => {
    if (event.target === taskModal) {
      closeModal();
    }
  });
  taskForm.addEventListener("submit", handleFormSubmit);
  document.addEventListener("click", handleOutsideMultiSelectClick);

  // Bulk action listeners
  document.getElementById("selectAllCheckbox").addEventListener("change", handleSelectAll);
  document.getElementById("bulkChangeStatusBtn").addEventListener("click", handleBulkChangeStatus);
  document.getElementById("bulkDeleteBtn").addEventListener("click", handleBulkDelete);

  initUserDisplay();
  setupDescriptionTooltip();
  loadTasksFromBackend();
}

function initUserDisplay() {
  const user = getUser();
  if (user) {
    document.getElementById("displayUserName").textContent = user.email.split("@")[0];
    const avatarEl = document.getElementById("displayAvatar");
    if (avatarEl) {
      avatarEl.textContent = user.email[0].toUpperCase();
    }
    
    // Check admin role to show an admin link (optional for now, can be expanded later)
    if (user.role === "ADMIN") {
      const headerRight = document.querySelector(".header-right");
      const adminLink = document.createElement("a");
      adminLink.href = "./admin.html";
      adminLink.textContent = "Admin Panel";
      adminLink.className = "primary-button";
      adminLink.style.marginRight = "16px";
      adminLink.style.background = "var(--primary)";
      adminLink.style.color = "white";
      adminLink.style.textDecoration = "none";
      headerRight.insertBefore(adminLink, headerRight.firstChild);
    }
  }
}

async function loadTasksFromBackend() {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error("Could not load tasks from backend");
    }

    tasks = await response.json();
    populateFilters();
    renderDashboard();
  } catch (error) {
    console.error(error);
    window.alert(
      "Could not connect to backend. Please make sure backend server is running."
    );
  }
}

function populateFilters() {
  const statuses = [...new Set([...statusOptions, ...tasks.map((task) => task.status)])];
  const priorities = [...new Set(tasks.map((task) => task.priority))];

  renderMultiSelect(statusFilter, "Status", statuses, selectedStatuses, "status");
  renderMultiSelect(priorityFilter, "Priority", priorities, selectedPriorities, "priority");
}

function renderDashboard() {
  const filteredTasks = getFilteredTasks();
  const paginatedTasks = getPaginatedTasks(filteredTasks);

  renderStats(filteredTasks);
  renderTable(paginatedTasks);
  renderPagination(filteredTasks.length, paginatedTasks.length);

  taskCountLabel.textContent = `${filteredTasks.length} task${
    filteredTasks.length === 1 ? "" : "s"
  }`;
}

function getFilteredTasks() {
  const searchValue = searchInput.value.trim().toLowerCase();

  return tasks.filter((task) => {
    const matchesSearch =
      !searchValue ||
      [
        task.platform,
        task.moduleName,
        task.owners,
        task.technicalTeam,
        task.comments,
        task.description,
      ]
        .join(" ")
        .toLowerCase()
        .includes(searchValue);

    const matchesStatus =
      selectedStatuses.length === 0 || selectedStatuses.includes(task.status);
    const matchesPriority =
      selectedPriorities.length === 0 || selectedPriorities.includes(task.priority);

    return matchesSearch && matchesStatus && matchesPriority;
  });
}

function renderMultiSelect(container, label, options, selectedValues, type) {
  container.classList.add("is-closed");
  container.innerHTML = `
    <button type="button" class="multi-select-button">
      <span class="multi-select-summary">${getMultiSelectSummary(label, selectedValues)}</span>
    </button>
    <div class="multi-select-menu">
      ${options
        .map(
          (option) => `
            <label class="multi-select-option">
              <input
                type="checkbox"
                value="${option}"
                data-filter-type="${type}"
                ${selectedValues.includes(option) ? "checked" : ""}
              />
              <span>${option}</span>
            </label>
          `
        )
        .join("")}
    </div>
  `;

  const button = container.querySelector(".multi-select-button");
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    closeOtherMultiSelects(container);
    container.classList.toggle("is-closed");
  });

  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", handleMultiSelectChange);
  });
}

function getMultiSelectSummary(label, selectedValues) {
  if (!selectedValues.length) {
    return `All ${label}`;
  }

  return selectedValues.join(", ");
}

function handleMultiSelectChange(event) {
  const { value, checked, dataset } = event.target;
  const isStatusFilter = dataset.filterType === "status";
  const currentValues = isStatusFilter ? selectedStatuses : selectedPriorities;
  const updatedValues = checked
    ? [...currentValues, value]
    : currentValues.filter((item) => item !== value);

  if (isStatusFilter) {
    selectedStatuses = updatedValues;
  } else {
    selectedPriorities = updatedValues;
  }

  currentPage = 1;
  populateFilters();
  renderDashboard();
}

function closeOtherMultiSelects(activeContainer) {
  document.querySelectorAll(".multi-select").forEach((container) => {
    if (container !== activeContainer) {
      container.classList.add("is-closed");
    }
  });
}

function handleOutsideMultiSelectClick(event) {
  if (!event.target.closest(".multi-select")) {
    document.querySelectorAll(".multi-select").forEach((container) => {
      container.classList.add("is-closed");
    });
  }
}

function renderStats(filteredTasks) {
  const stats = [
    { label: "Total Tasks", value: filteredTasks.length, cardClass: "" },
    {
      label: "Product",
      value: filteredTasks.filter((task) => task.status === "Product").length,
      cardClass: "status-product-card",
    },
    {
      label: "Design",
      value: filteredTasks.filter((task) => task.status === "Design").length,
      cardClass: "status-design-card",
    },
    {
      label: "Development",
      value: filteredTasks.filter((task) => task.status === "Development").length,
      cardClass: "status-development-card",
    },
    {
      label: "Testing",
      value: filteredTasks.filter((task) => task.status === "Testing").length,
      cardClass: "status-testing-card",
    },
    {
      label: "On Hold",
      value: filteredTasks.filter((task) => task.status === "On Hold").length,
      cardClass: "status-on-hold-card",
    },
    {
      label: "Deployed",
      value: filteredTasks.filter((task) => task.status === "Deployed").length,
      cardClass: "status-deployed-card",
    },
  ];

  statsGrid.innerHTML = stats
    .map(
      (stat) => `
        <article class="stat-card ${stat.cardClass}">
          <p class="stat-label">${stat.label}</p>
          <p class="stat-value">${stat.value}</p>
        </article>
      `
    )
    .join("");
}

function renderTable(filteredTasks) {
  if (!filteredTasks.length) {
    taskTableBody.innerHTML = `
      <tr>
        <td colspan="14" class="empty-state">No tasks found for the selected filters.</td>
      </tr>
    `;
    updateBulkActionBar();
    return;
  }

  taskTableBody.innerHTML = filteredTasks
    .map(
      (task) => `
        <tr class="${selectedTaskIds.has(task.id) ? 'row-selected' : ''}">
          <td class="checkbox-col"><input type="checkbox" class="row-checkbox" data-task-id="${task.id}" ${selectedTaskIds.has(task.id) ? 'checked' : ''} /></td>
          <td>${task.platform}</td>
          <td>${task.moduleName}</td>
          <td>${task.owners}</td>
          <td><span class="badge ${getPriorityClass(task.priority)}">${task.priority}</span></td>
          <td>${task.categoryType || "-"}</td>
          <td><span class="badge ${getStatusClass(task.status)}">${task.status}</span></td>
          <td>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${task.percentCompleted || 0}%"></div>
            </div>
            ${task.percentCompleted || 0}%
          </td>
          <td>${formatDisplayDate(task.startDate)}</td>
          <td>${formatDisplayDate(task.completedDate)}</td>
          <td class="description-cell" data-description="${(task.description || '').replace(/"/g, '&quot;')}"><span class="description-truncate">${task.description || "-"}</span></td>
          <td>${task.technicalTeam || "-"}</td>
          <td>${task.comments || "-"}</td>
          <td>
            <div class="actions-cell">
              <button class="action-button" onclick="editTask('${task.id}')">Edit</button>
              <button class="action-button delete" onclick="deleteTask(event, '${task.id}')">Delete</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  // Attach row checkbox listeners
  taskTableBody.querySelectorAll('.row-checkbox').forEach(cb => {
    cb.addEventListener('change', handleRowCheckboxChange);
  });

  updateSelectAllCheckbox(filteredTasks);
  updateBulkActionBar();
}

function getPaginatedTasks(filteredTasks) {
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / pageSize));

  if (currentPage > totalPages) {
    currentPage = totalPages;
  }

  const startIndex = (currentPage - 1) * pageSize;
  return filteredTasks.slice(startIndex, startIndex + pageSize);
}

function renderPagination(totalItems, itemsOnPage) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = totalItems === 0 ? 0 : startItem + itemsOnPage - 1;

  paginationInfo.textContent = `Showing ${startItem} to ${endItem} of ${totalItems}`;
  previousPageButton.disabled = currentPage === 1;
  nextPageButton.disabled = currentPage >= totalPages;
}

function handlePageSizeChange(event) {
  pageSize = Number(event.target.value);
  currentPage = 1;
  renderDashboard();
}

function goToPreviousPage() {
  if (currentPage > 1) {
    currentPage -= 1;
    renderDashboard();
  }
}

function goToNextPage() {
  const totalItems = getFilteredTasks().length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (currentPage < totalPages) {
    currentPage += 1;
    renderDashboard();
  }
}

function getPriorityClass(priority) {
  return `priority-${priority.toLowerCase()}`;
}

function getStatusClass(status) {
  return `status-${status.toLowerCase().replaceAll(" ", "-")}`;
}

function formatDisplayDate(value) {
  if (!value || value === "-") {
    return "-";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function normalizeDateForInput(value) {
  if (!value || value === "-") {
    return "";
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return value;
}

function openModal(task = null) {
  editingTaskId = task?.id || null;
  modalTitle.textContent = editingTaskId ? "Edit Task" : "Add New Task";
  taskForm.reset();

  document.getElementById("taskId").value = task?.id || "";
  document.getElementById("platform").value = task?.platform || "";
  document.getElementById("moduleName").value = task?.moduleName || "";
  document.getElementById("owners").value = task?.owners || "";
  document.getElementById("priority").value = task?.priority || "Urgent";
  document.getElementById("categoryType").value = task?.categoryType || "New Feature";
  document.getElementById("status").value = task?.status || "Product";
  document.getElementById("percentCompleted").value = task?.percentCompleted ?? 0;
  document.getElementById("deadline").value = normalizeDateForInput(task?.startDate);
  document.getElementById("ogDeadline").value = normalizeDateForInput(task?.completedDate);
  document.getElementById("description").value = task?.description || "";
  document.getElementById("technicalTeam").value = task?.technicalTeam || "";
  document.getElementById("comments").value = task?.comments || "";

  taskModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeModal() {
  taskModal.classList.add("hidden");
  editingTaskId = null;
  document.body.classList.remove("modal-open");
}

async function handleFormSubmit(event) {
  event.preventDefault();

  const formData = new FormData(taskForm);
  const percentCompletedValue = formData.get("percentCompleted");
  const taskData = {
    platform: formData.get("platform").trim(),
    moduleName: formData.get("moduleName").trim(),
    owners: formData.get("owners").trim(),
    priority: formData.get("priority"),
    categoryType: formData.get("categoryType") || "-",
    status: formData.get("status"),
    percentCompleted: percentCompletedValue ? Number(percentCompletedValue) : 0,
    startDate: formData.get("deadline") || "-",
    completedDate: formData.get("ogDeadline") || "-",
    description: formData.get("description").trim(),
    technicalTeam: formData.get("technicalTeam").trim(),
    comments: formData.get("comments").trim(),
  };

  try {
    const requestUrl = editingTaskId
      ? `${API_BASE_URL}/tasks/${editingTaskId}`
      : `${API_BASE_URL}/tasks`;
    const requestMethod = editingTaskId ? "PUT" : "POST";

    const response = await fetch(requestUrl, {
      method: requestMethod,
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders()
      },
      body: JSON.stringify(taskData),
    });

    if (!response.ok) {
      throw new Error("Task could not be saved");
    }

    currentPage = 1;
    closeModal();
    await loadTasksFromBackend();
  } catch (error) {
    console.error(error);
    window.alert("Could not save task to backend.");
  }
}

function resetFilters() {
  searchInput.value = "";
  selectedStatuses = [];
  selectedPriorities = [];
  currentPage = 1;
  populateFilters();
  renderDashboard();
}

function exportFilteredTasks() {
  const filteredTasks = getFilteredTasks();

  if (!filteredTasks.length) {
    window.alert("No filtered data is available to export.");
    return;
  }

  const exportRows = filteredTasks.map((task) => ({
    Platform: task.platform || "-",
    "Module Name": task.moduleName || "-",
    Owners: task.owners || "-",
    Priority: task.priority || "-",
    Category: task.categoryType || "-",
    Status: task.status || "-",
    "% Complete": task.percentCompleted ?? 0,
    "Start Date": formatDisplayDate(task.startDate),
    "Completed Date": formatDisplayDate(task.completedDate),
    Description: task.description || "-",
    "Technical Team": task.technicalTeam || "-",
    Comments: task.comments || "-",
  }));

  const headers = Object.keys(exportRows[0]);
  const csvContent = [
    headers.join(","),
    ...exportRows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(",")
    ),
  ].join("\n");

  const blob = new Blob([csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const dateStamp = new Date().toISOString().slice(0, 10);

  link.href = downloadUrl;
  link.download = `project-dashboard-export-${dateStamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(downloadUrl);
}

function escapeCsvValue(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
}

function editTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (task) {
    openModal(task);
  }
}

async function deleteTask(event, taskId) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  // Small delay to prevent browser focus issues with native alerts
  setTimeout(async () => {
    const confirmed = window.confirm("Do you want to delete this task?");
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error("Task could not be deleted");
      }

      await loadTasksFromBackend();
    } catch (error) {
      console.error(error);
      window.alert("Could not delete task from backend.");
    }
  }, 10);
}

window.editTask = editTask;
window.deleteTask = deleteTask;

// --- Multi-Select / Bulk Actions ---

function handleRowCheckboxChange(event) {
  const taskId = event.target.dataset.taskId;
  if (event.target.checked) {
    selectedTaskIds.add(taskId);
  } else {
    selectedTaskIds.delete(taskId);
  }
  // Re-render to update row highlight & select-all state
  const filteredTasks = getFilteredTasks();
  const paginatedTasks = getPaginatedTasks(filteredTasks);
  renderTable(paginatedTasks);
}

function handleSelectAll(event) {
  const filteredTasks = getFilteredTasks();
  const paginatedTasks = getPaginatedTasks(filteredTasks);

  if (event.target.checked) {
    paginatedTasks.forEach(task => selectedTaskIds.add(task.id));
  } else {
    paginatedTasks.forEach(task => selectedTaskIds.delete(task.id));
  }

  renderTable(paginatedTasks);
}

function updateSelectAllCheckbox(paginatedTasks) {
  const selectAll = document.getElementById('selectAllCheckbox');
  if (!paginatedTasks.length) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
    return;
  }
  const allChecked = paginatedTasks.every(t => selectedTaskIds.has(t.id));
  const someChecked = paginatedTasks.some(t => selectedTaskIds.has(t.id));
  selectAll.checked = allChecked;
  selectAll.indeterminate = someChecked && !allChecked;
}

function updateBulkActionBar() {
  const bar = document.getElementById('bulkActionBar');
  const countLabel = document.getElementById('bulkSelectedCount');
  const count = selectedTaskIds.size;

  if (count > 0) {
    bar.classList.remove('hidden');
    countLabel.textContent = `${count} task${count > 1 ? 's' : ''} selected`;
  } else {
    bar.classList.add('hidden');
  }
}

async function handleBulkChangeStatus() {
  if (selectedTaskIds.size === 0) return;
  const newStatus = document.getElementById('bulkStatusSelect').value;
  const confirmed = window.confirm(`Change status of ${selectedTaskIds.size} task(s) to "${newStatus}"?`);
  if (!confirmed) return;

  try {
    const promises = Array.from(selectedTaskIds).map(taskId => {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return Promise.resolve();
      const updatedData = {
        platform: task.platform,
        moduleName: task.moduleName,
        owners: task.owners,
        priority: task.priority,
        categoryType: task.categoryType || "-",
        status: newStatus,
        percentCompleted: task.percentCompleted || 0,
        startDate: task.startDate || "-",
        completedDate: task.completedDate || "-",
        description: task.description || "",
        technicalTeam: task.technicalTeam,
        comments: task.comments || "",
      };
      return fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(updatedData),
      });
    });
    await Promise.all(promises);
    selectedTaskIds.clear();
    await loadTasksFromBackend();
  } catch (error) {
    console.error(error);
    window.alert('Could not update tasks. Please try again.');
  }
}

async function handleBulkDelete() {
  if (selectedTaskIds.size === 0) return;
  const confirmed = window.confirm(`Delete ${selectedTaskIds.size} task(s)? This cannot be undone.`);
  if (!confirmed) return;

  try {
    const promises = Array.from(selectedTaskIds).map(taskId =>
      fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      })
    );
    await Promise.all(promises);
    selectedTaskIds.clear();
    await loadTasksFromBackend();
  } catch (error) {
    console.error(error);
    window.alert('Could not delete tasks. Please try again.');
  }
}

function setupDescriptionTooltip() {
  if (!document.getElementById("descriptionGlobalTooltip")) {
    globalTooltip = document.createElement("div");
    globalTooltip.id = "descriptionGlobalTooltip";
    globalTooltip.className = "description-global-tooltip hidden";
    document.body.appendChild(globalTooltip);
  } else {
    globalTooltip = document.getElementById("descriptionGlobalTooltip");
  }

  document.addEventListener("mouseover", (event) => {
    const cell = event.target.closest(".description-cell");
    if (!cell || !globalTooltip) return;

    const desc = cell.getAttribute("data-description");
    if (!desc || desc.trim() === "" || desc === "-") return;

    globalTooltip.textContent = desc;
    globalTooltip.classList.remove("hidden");
    setTimeout(() => {
      globalTooltip.classList.add("visible");
    }, 10);

    const updatePosition = () => {
      const rect = cell.getBoundingClientRect();
      let top = window.scrollY + rect.top - globalTooltip.offsetHeight - 10;
      let left = window.scrollX + rect.left + (rect.width / 2) - (globalTooltip.offsetWidth / 2);

      if (left < 10) {
        left = 10;
      }
      const maxLeft = window.innerWidth - globalTooltip.offsetWidth - 10;
      if (left > maxLeft) {
        left = maxLeft;
      }
      if (rect.top - globalTooltip.offsetHeight - 10 < 10) {
        top = window.scrollY + rect.bottom + 10;
      }

      globalTooltip.style.top = `${top}px`;
      globalTooltip.style.left = `${left}px`;
    };

    updatePosition();
    
    const handleScrollResize = () => {
      if (!globalTooltip.classList.contains("hidden")) {
        updatePosition();
      }
    };
    window.addEventListener("scroll", handleScrollResize, { passive: true });
    window.addEventListener("resize", handleScrollResize, { passive: true });

    const handleMouseLeave = () => {
      if (globalTooltip) {
        globalTooltip.classList.remove("visible");
        globalTooltip.classList.add("hidden");
      }
      cell.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("scroll", handleScrollResize);
      window.removeEventListener("resize", handleScrollResize);
    };
    cell.addEventListener("mouseleave", handleMouseLeave);
  });
}

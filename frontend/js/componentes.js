// Utilitários e componentes de interface compartilhados entre as telas do prontuário.
(() => {
  "use strict"

  function normalize(text) {
    return String(text).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  }

  // Cria elementos sem usar innerHTML (evita injeção de HTML a partir de dados).
  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag)
    Object.entries(props).forEach(([key, value]) => {
      if (key === "class") node.className = value
      else if (key === "text") node.textContent = value
      else if (value === true) node.setAttribute(key, "")
      else if (value !== false && value != null) node.setAttribute(key, value)
    })
    node.append(...children)
    return node
  }

  function todayIso() {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    return `${now.getFullYear()}-${month}-${day}`
  }

  function formatDate(iso) {
    const [year, month, day] = String(iso || "").split("-")
    return year && month && day ? `${day}/${month}/${year}` : "—"
  }

  function currentUserName() {
    return sessionStorage.getItem("huNefroUsername") || "Usuário"
  }

  // Combobox acessível com busca (ARIA 1.2): usado para CID.
  // items: [{ code, description, label }]
  function createCombo({ input, list, clearButton, items, onChange }) {
    let selected = null
    let visible = []
    let active = -1

    function render() {
      list.replaceChildren()
      if (visible.length === 0) {
        list.append(el("li", { class: "dc-combo-empty", role: "presentation", text: "Nenhum CID encontrado." }))
        return
      }
      visible.forEach((item, index) => {
        list.append(
          el(
            "li",
            { class: "dc-combo-option", role: "option", id: `${list.id}-${index}`, "aria-selected": String(index === active) },
            el("span", { class: "dc-code", text: item.code }),
            el("span", { text: item.description }),
          ),
        )
      })
    }

    function open() {
      list.hidden = false
      input.setAttribute("aria-expanded", "true")
    }

    function close() {
      list.hidden = true
      input.setAttribute("aria-expanded", "false")
      input.removeAttribute("aria-activedescendant")
      active = -1
    }

    function setActive(index) {
      active = index
      list.querySelectorAll('[role="option"]').forEach((option, i) => {
        option.setAttribute("aria-selected", String(i === active))
        if (i === active) {
          option.scrollIntoView({ block: "nearest" })
          input.setAttribute("aria-activedescendant", option.id)
        }
      })
    }

    function filter(query) {
      const terms = normalize(query).split(/\s+/).filter(Boolean)
      visible = items
        .filter((item) => {
          const haystack = normalize(`${item.code} ${item.description}`)
          return terms.every((term) => haystack.includes(term))
        })
        .slice(0, 50)
      active = visible.length ? 0 : -1
      render()
      if (active === 0) input.setAttribute("aria-activedescendant", `${list.id}-0`)
      open()
    }

    function choose(item, { silent = false } = {}) {
      selected = item
      input.value = item ? item.label : ""
      clearButton.hidden = !item
      close()
      if (!silent) onChange?.(item)
    }

    input.addEventListener("input", () => filter(input.value))
    input.addEventListener("click", () => {
      if (list.hidden) filter(selected ? "" : input.value)
    })
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        if (list.hidden) {
          filter(selected ? "" : input.value)
          return
        }
        if (!visible.length) return
        const step = event.key === "ArrowDown" ? 1 : -1
        setActive((active + step + visible.length) % visible.length)
      } else if (event.key === "Enter" && !list.hidden && active >= 0) {
        event.preventDefault()
        choose(visible[active])
      } else if (event.key === "Escape" && !list.hidden) {
        // Fecha só a lista; não deixa o Esc fechar um diálogo que contenha o campo.
        event.preventDefault()
        event.stopPropagation()
        close()
        input.value = selected ? selected.label : ""
      }
    })
    input.addEventListener("blur", () => {
      close()
      input.value = selected ? selected.label : ""
    })
    list.addEventListener("mousedown", (event) => {
      event.preventDefault() // mantém o foco no campo
      const option = event.target.closest('[role="option"]')
      if (option) choose(visible[Number(option.id.split("-").pop())])
    })
    clearButton.addEventListener("click", () => {
      choose(null)
      input.focus()
    })

    return {
      get value() { return selected },
      setByCode(code) { choose(items.find((item) => item.code === code) || null, { silent: true }) },
    }
  }

  // Monta o markup do combobox de CID dinamicamente (para diálogos).
  function createCidField({ id, items, onChange }) {
    const input = el("input", {
      class: "form-control",
      id,
      role: "combobox",
      "aria-autocomplete": "list",
      "aria-expanded": "false",
      "aria-controls": `${id}-list`,
      autocomplete: "off",
      placeholder: "Buscar por código ou descrição",
      "data-no-dirty": true,
    })
    const clearButton = el("button", { class: "dc-combo-clear", type: "button", "aria-label": "Limpar CID", hidden: true, text: "×" })
    const list = el("ul", { class: "dc-combo-list", id: `${id}-list`, role: "listbox", "aria-label": "Resultados da busca de CID", hidden: true })
    const root = el("div", { class: "dc-combo" }, input, clearButton, list)
    return { root, input, combo: createCombo({ input, list, clearButton, items, onChange }) }
  }

  window.HuNefroUI = { normalize, el, todayIso, formatDate, currentUserName, createCombo, createCidField }
})()

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
    return year && month && day ? `${day}/${month}/${year}` : "-"
  }

  const pad2 = (n) => String(n).padStart(2, "0")
  const toIso = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  const fromIso = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d) }

  function addDays(iso, days) {
    const date = fromIso(iso)
    date.setDate(date.getDate() + days)
    return toIso(date)
  }

  // "dd/mm/aaaa" -> "aaaa-mm-dd"
  function brToIso(br) {
    const [day, month, year] = String(br || "").split("/")
    return year && month && day ? `${year}-${month}-${day}` : ""
  }

  // Número digitado no padrão brasileiro ("72,5") -> 72.5. Vazio vira 0 e texto inválido vira NaN.
  function parseNumber(value) {
    return Number(String(value ?? "").trim().replace(",", "."))
  }

  // 72.5 -> "72,5" (com casas decimais fixas quando digits é informado).
  function formatDecimal(value, digits) {
    const text = digits === undefined ? String(value) : (Math.round(value * 10 ** digits) / 10 ** digits).toFixed(digits)
    return text.replace(".", ",")
  }

  // "Circunferência do braço (cm)" -> "circunferencia-do-braco-cm"
  function slug(text) {
    return normalize(text).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
  }

  // Avisa o prontuário que há alterações não salvas.
  function markDirty() {
    document.dispatchEvent(new CustomEvent("hunefro:dirty"))
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

  // Select com opção "Outro": ao escolhê-la aparece um campo para especificar.
  // Uma opção da lista chamada "Outro"/"Outra"/"Outros" passa a ser o gatilho; senão, "Outro" é acrescentada no fim.
  // control.value devolve o valor escolhido ou o texto especificado; control.missingOther indica "Outro" sem texto.
  const OTHER = "__outro__"
  const isOtherLabel = (text) => /^outr[oa]s?$/i.test(String(text).trim())

  function createSelectWithOther({ id, options, value = "", otherLabel = "Outro", placeholder = "Especifique", className = "form-select" }) {
    const regular = options.filter(([v, l]) => !isOtherLabel(l) && !isOtherLabel(v))
    const label = (options.find(([v, l]) => isOtherLabel(l) || isOtherLabel(v)) || [, otherLabel])[1]
    const select = el(
      "select",
      { class: className, id, "data-no-dirty": true },
      el("option", { value: "", text: "Selecione" }),
      ...regular.map(([v, l]) => el("option", { value: v, text: l })),
      el("option", { value: OTHER, text: label }),
    )
    const input = el("input", { class: "form-control hn-other-input", id: `${id}-outro`, autocomplete: "off", placeholder, "aria-label": `${label}: especifique`, "data-no-dirty": true, hidden: true })
    const sync = () => {
      input.hidden = select.value !== OTHER
      if (input.hidden) input.value = ""
    }
    select.addEventListener("change", () => {
      sync()
      if (!input.hidden) input.focus()
    })
    const control = {
      select,
      input,
      get value() {
        if (select.value !== OTHER) return select.value
        return input.value.trim() || label
      },
      set value(v) {
        const text = String(v ?? "").trim()
        if (!text) select.value = ""
        else if (regular.some(([key]) => key === text)) select.value = text
        else {
          select.value = OTHER
          input.hidden = false
          input.value = isOtherLabel(text) ? "" : text
          return
        }
        sync()
      },
      get missingOther() { return select.value === OTHER && !input.value.trim() },
      focus() { (control.missingOther ? input : select).focus() },
      addEventListener: (...args) => select.addEventListener(...args),
    }
    control.value = value
    return { root: el("div", { class: "hn-other" }, select, input), control }
  }

  // Paciente com cateter dialisa sem punção: os campos de agulha não se aplicam.
  // Aceita o tipo do acesso ("cateter") ou o texto do acesso ("Cateter de longa permanência - Jugular direita").
  const isCatheterAccess = (access) => normalize(access || "").includes("cateter")
  const NEEDLE_NOT_APPLICABLE = "Não se aplica (cateter)"

  window.HuNefroUI = {
    isCatheterAccess, NEEDLE_NOT_APPLICABLE,
    normalize, el, todayIso, formatDate, addDays, brToIso, parseNumber, formatDecimal, slug, markDirty, currentUserName,
    createCombo, createCidField, createSelectWithOther, isOtherLabel }
})()

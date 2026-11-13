class DataTemplateElement extends HTMLElement {
    constructor() {
        super()
        this._data = null
    }

    set data(value) {
        this._data = value
        this.render()
    }

    get data() {
        return this._data
    }

    connectedCallback() {
        this.render()
    }

    templateContent(id) {
        return document.getElementById(id).content.cloneNode(true)
    }
}
function link_or_bold(url, name, item) {
    const link = item.querySelector("a")
    const bold = item.querySelector("b")
    if (url) {
        link.href = url;
        link.textContent = name ?? "";
        bold.remove()
    }
    else {
        bold.textContent = name;
        link.remove()
    }
}
class CvLinkList extends DataTemplateElement {
    render() {
        if (!this.isConnected || !this.data) return

        const content = this.templateContent("link-list-template")
        const heading = content.querySelector("h4")
        const list = content.querySelector("ul")
        heading.textContent = this.data.title ?? ""
        heading.hidden = !this.data.title

        for (const entry of this.data.content ?? []) {
            const item = this.templateContent("link-list-item-template").firstElementChild
            // const text = item.querySelector("li")
            link_or_bold(entry?.url, entry.name, item)

            item.append(`: ${entry.desc ?? ""}`)
            list.append(item)
        }

        this.replaceChildren(content)
    }
}

class CvPersonalInfo extends DataTemplateElement {
    render() {
        if (!this.isConnected || !this.data) return

        const content = this.templateContent("personal-info-template")
        const list = content.querySelector("ul")

        for (const entry of this.data.content ?? []) {
            const item = this.templateContent("personal-info-item-template").firstElementChild
            const title = item.querySelector("b")
            const link = item.querySelector("a")
            title.textContent = `${entry.name}: `

            if (entry.url) {
                link.href = entry.url
                link.textContent = entry.cont ?? ""
            } else {
                link.remove()
                item.append(document.createTextNode(entry.cont ?? ""))
            }
            list.append(item)
        }

        this.replaceChildren(content)
    }
}

class CvSkillList extends DataTemplateElement {
    render() {
        if (!this.isConnected || !this.data) return

        const content = this.templateContent("skill-list-template")
        const heading = content.querySelector("h3")
        const list = content.querySelector("ul")
        heading.textContent = this.data.title ?? ""
        heading.hidden = !this.data.title

        for (const entry of this.data.content ?? []) {
            const item = this.templateContent("skill-item-template").firstElementChild
            const text = item.querySelector("p")
            link_or_bold(entry?.url, entry.name, text)

            text.append(`: ${entry.desc ?? " "}`)
            list.append(item)
        }

        this.replaceChildren(content)
    }
}

class CvTimelineList extends DataTemplateElement {
    render() {
        if (!this.isConnected || !this.data) return

        const content = this.templateContent("timeline-list-template")
        const heading = content.querySelector("h3")
        const list = content.querySelector("ul")
        heading.textContent = this.data.title ?? ""
        heading.hidden = !this.data.title

        for (const entry of this.data.content ?? []) {
            const item = this.templateContent("timeline-item-template").firstElementChild
            const description = item.querySelector(".description")
            const link = description.querySelector("a")
            item.querySelector(".year").textContent = entry.end_year ?? ""
            item.querySelector(".period").textContent = `${entry.start ?? ""} - ${entry.end ?? ""}`

            if (entry.url) {
                link.href = entry.url
                link.textContent = entry.desc ?? ""
            } else {
                link.remove()
                description.textContent = entry.desc ?? ""
                if (entry.institution) description.append(` | ${entry.institution}`)
            }
            list.append(item)
        }

        this.replaceChildren(content)
    }
}

class CvStylePicker extends HTMLElement {
    constructor() {
        super()
        this.handleChange = () => {
            this.style_link.setAttribute("href", this.select.value)
        }
        this.select = this.querySelector("select")
        this.style_link = document.getElementById("theme-stylesheet")
    }

    connectedCallback() {
        const stylesheet = this.style_link
        const select = this.select
        if (!stylesheet || !select) return

        select.value = this.style_link.getAttribute("href")
        select.addEventListener("change", this.handleChange)
    }

    disconnectedCallback() {
        this.querySelector("select")
            ?.removeEventListener("change", this.handleChange)
    }


}

customElements.define("cv-link-list", CvLinkList)
customElements.define("cv-personal-info", CvPersonalInfo)
customElements.define("cv-skill-list", CvSkillList)
customElements.define("cv-timeline-list", CvTimelineList)
customElements.define("cv-style-picker", CvStylePicker)
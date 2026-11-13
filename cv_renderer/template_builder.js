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
            const link = item.querySelector("a")

            if (entry.url) {
                link.href = entry.url
                link.textContent = entry.name
            } else {
                link.remove()
                item.append(document.createTextNode(entry.name ?? ""))
            }
            if (entry.desc) item.append(document.createTextNode(` - ${entry.desc}`))
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
            const link = text.querySelector("a");
            const bold = text.querySelector("b")

            if (entry?.url) {
                link.href = entry.url;
                link.textContent = entry.name ?? "";
                bold.remove()
            }
            else {
                text.querySelector("b").textContent = entry.name;
                link.remove()
            }
            text.append(`: ${entry.desc ?? ""}`)
            // item.querySelector("p").textContent = `${entry.name ?? ""}: ${entry.desc ?? ""}`
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

customElements.define("cv-link-list", CvLinkList)
customElements.define("cv-personal-info", CvPersonalInfo)
customElements.define("cv-skill-list", CvSkillList)
customElements.define("cv-timeline-list", CvTimelineList)
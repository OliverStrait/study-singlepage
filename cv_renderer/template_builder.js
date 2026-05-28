class Template {
    constructor(node) {
        this.root = node
        this.parse_children()
    }
    static createRootTemplate(elementID) {
        const template = new Template(document.getElementById(elementID))
        document.getElementById(elementID).remove()
        return template
    }
    parse_children() {
        for (let n of this.root.children) {
            let name = n?.attributes["temp"]?.nodeValue
            if (name) {
                n.removeAttribute("temp")
                this[name] = new Template(n)
            }
        }
    }
    new(custom_id = null) {
        let clone = this.root.cloneNode()
        console.log(this.root.classlist, clone.classlist)
        clone.id = custom_id ? custom_id : Date.now()
        return clone
    }
    get_tree(list) {
        var [last, res] = [this, []]
        for (let name of list) { last = last[name]; res.push(last) }
        return res
    }
    operate(parent, arg, func,) {
        let root = parent.appendChild(this.new())
        func(root, this, arg)
    }

}
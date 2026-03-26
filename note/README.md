# Simple Note-page

Produce little single-page note-application that can create new notes and show old ones
[Open](/note.html)

## Challenge goal

- Using only HTML, CSS and JavaScript
- note page that has capability to insert new net and read and delete old notes.
- Notes are stored locally in Browser memory [WebStorage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) 

## Status (Work in progress)

- [x] Static page layout prototype (html-DOM, css)
- [x] Javascript and Localstorage API
    - Store data in json-string 
- [x] Addition and removal from Local storage
- [x] New lines are parsed into note


## Stored datatype

``` json
{ver:1, 
notes: [{
    id: 1772008395138, 
    t: "Note title",
    date: "2026-02-12",
    n: "Whole text in",
}
]}
 
```

# Additions
- [ ] Randomly selected note
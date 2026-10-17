# md-view

A Markdown editor and viewer. People write in one pane and read the rendered result in the other, and can share what they wrote as a public link.

## Language

**Draft**:
The document in a person's own editor, kept only in their browser.
_Avoid_: Local document, current document

**Shared document**:
A frozen copy of a draft, stored on the server and readable by anyone with its share link. It never changes after creation.
_Avoid_: Paste, snapshot, note

**Share link**:
The public address of a shared document, `https://md.akbarakma.com/d/{id}`. Adding `.md` gives the raw Markdown.
_Avoid_: Short link, short URL

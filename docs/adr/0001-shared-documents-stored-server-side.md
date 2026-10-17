# Shared documents are stored on the server, not in the URL

Sharing used to compress the whole draft into the URL hash and pass that URL through the separate shorten-url service. That capped shares at 70 KB (the redirect header stalled Cloudflare above ~87 KB), and agents could not read a share because browsers never send the hash to a server. md-view now stores each shared document in its own Postgres table and links to it by a random 10-character id. The shortener was already storing the full content inside the URL, so this gives up no privacy that existed before.

## Consequences

- Old `#d=` / `#s=` hash links and the short links pointing at them no longer load a document. This was an accepted clean switch.
- Shared documents never change and identical content returns the same link, so sharing needs no accounts or edit tokens.

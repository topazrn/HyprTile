NAME=hyprtile
DOMAIN=topazrn.com

.PHONY: all pack install clean

all: dist/extension.js

node_modules: package.json
	bun install

dist/extension.js dist/prefs.js: node_modules
	bunx tsc

schemas/gschemas.compiled: src/schemas/org.gnome.shell.extensions.$(NAME).gschema.xml
	glib-compile-schemas schemas

$(NAME).zip: dist/extension.js dist/prefs.js src/schemas/gschemas.compiled
	@cp -r src/schemas dist/
	@cp src/metadata.json dist/
	@(cd dist && zip ../$(NAME).zip -9r .)

pack: $(NAME).zip

install: $(NAME).zip
	@touch ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)
	@rm -rf ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)
	@mv dist ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)

clean:
	@rm -rf dist node_modules $(NAME).zip
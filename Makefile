NAME=hyprtile
DOMAIN=topazrn.com

.PHONY: all pack install clean

all: dist schemas

node_modules: package.json
	bun install

dist: node_modules
	bunx tsc

schemas: src/schemas/*
	glib-compile-schemas src/schemas

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

dev:
	MUTTER_DEBUG_DUMMY_MODE_SPECS=1920x1080 dbus-run-session -- gnome-shell --nested --wayland
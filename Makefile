.PHONY: install build link clean

install-playwright:
	npm run install-playwright

install:
	npm i

build: install install-playwright
	npm run build

link: build
	npm link

clean:
	npm run clean

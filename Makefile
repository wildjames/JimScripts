.PHONY: install build link clean

install-playwright:
	npm run install-playwright

install:
	npm install

build: install
	npm run build

link: build
	npm link

clean:
	npm run clean

TS_DIR := packages

.PHONY: install build link clean

install-playwright:
	cd $(TS_DIR) && npm run install-playwright

install:
	cd $(TS_DIR) && npm install

build: install
	cd $(TS_DIR) && npm run build

link: build
	cd $(TS_DIR) && npm link

clean:
	cd $(TS_DIR) && npm run clean

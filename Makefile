TS_DIR := typescript
PROJECTS := \
	psu-request-generator \
	psu-request-sender \
	pfp-request-sender \
	nhs-number-generator \
	prescription-id-generator

.PHONY: install build link clean

install-playwright:
	npx install playwright

install:
	@for project in $(PROJECTS); do \
		echo "==> Installing $$project"; \
		cd $(TS_DIR)/$$project && npm install; \
		cd ../..; \
	done

build: install
	@for project in $(PROJECTS); do \
		echo "==> Building $$project"; \
		cd $(TS_DIR)/$$project && npm run build; \
		cd ../..; \
	done

link: build
	@for project in $(PROJECTS); do \
		echo "==> Linking $$project"; \
		cd $(TS_DIR)/$$project && sudo npm link; \
		cd ../..; \
	done

clean:
	@for project in $(PROJECTS); do \
		echo "==> Cleaning $$project"; \
		rm -rf $(TS_DIR)/$$project/dist; \
		cd ../..; \
	done

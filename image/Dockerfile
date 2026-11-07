# Identical image for BOTH providers (Agent37 cloud build and E2B Template.fromDockerfile).
# Microsoft's official Playwright Python image: Ubuntu 24.04, Python 3.12, Playwright 1.64.1 + its Chromium.
FROM mcr.microsoft.com/playwright/python:v1.64.1-noble
ENV PIP_BREAK_SYSTEM_PACKAGES=1 PYTHONUNBUFFERED=1 PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN pip install --no-cache-dir playwright==1.64.1 browser-use==0.13.14 && python3 -c "import browser_use, playwright; print('ok')"
RUN chmod -R a+rX /ms-playwright
CMD ["sleep", "infinity"]

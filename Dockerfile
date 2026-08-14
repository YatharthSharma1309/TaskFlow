FROM node:22-alpine AS client
WORKDIR /client
COPY client/package.json client/package-lock.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
COPY server/ ./server/
COPY --from=client /client/dist ./client/dist
ENV PORT=3001
EXPOSE 3001
WORKDIR /app/server
CMD ["sh", "-c", "python -m uvicorn main:app --host 0.0.0.0 --port ${PORT}"]

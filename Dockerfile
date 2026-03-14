FROM node:25-bookworm-slim AS web-builder
WORKDIR /workspace
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/creator-console ./apps/creator-console
COPY apps/hosted-control ./apps/hosted-control
RUN npm ci
RUN npm run build

FROM golang:1.25-bookworm AS go-builder
WORKDIR /workspace
COPY go.mod go.sum ./
RUN go mod download
COPY cmd ./cmd
COPY internal ./internal
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /out/control-api ./cmd/control-api

FROM debian:bookworm-slim
WORKDIR /srv/taas
ENV PORT=8080
ENV STATIC_ROOT=/srv/taas
COPY --from=go-builder /out/control-api /usr/local/bin/control-api
COPY --from=web-builder /workspace/apps /srv/taas/apps
EXPOSE 8080
CMD ["sh", "-c", "CONTROL_API_ADDR=0.0.0.0:${PORT} control-api"]


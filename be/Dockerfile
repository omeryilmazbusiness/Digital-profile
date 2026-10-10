# Production image: the API and its operational CLI (migrations, admin account) as static
# binaries on a small non-root base. The shell is kept for `railway ssh` / `docker exec`.
#
#   docker build -t digital-profile-api be
#   start:      /app/api
#   pre-deploy: /app/cli migrate up

FROM golang:1.27-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Set by Railway to the deployed commit; shown by /healthz.
ARG RAILWAY_GIT_COMMIT_SHA=dev
# nodynamic: WebP never looks for a system libwebp, which would link against glibc's loader.
RUN set -eu; \
    ldflags="-s -w -X github.com/omeryilmazbusiness/digital-profile/be/internal/buildinfo.Version=${RAILWAY_GIT_COMMIT_SHA}"; \
    CGO_ENABLED=0 go build -tags nodynamic -trimpath -ldflags "$ldflags" -o /out/api ./cmd/api; \
    CGO_ENABLED=0 go build -tags nodynamic -trimpath -ldflags "$ldflags" -o /out/cli ./cmd/cli

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata \
    && adduser -D -H -u 10001 app \
    && mkdir -p /data/storage && chown -R app:app /data
WORKDIR /app
COPY --from=build /out/api /out/cli /app/
ENV APP_ENV=production \
    HTTP_ADDR=:8080 \
    LOG_FORMAT=json \
    STORAGE_LOCAL_DIR=/data/storage
USER app
EXPOSE 8080
CMD ["/app/api"]

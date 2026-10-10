# Production image: the API and its operational CLI (migrations, admin account) as static
# binaries on a small non-root base. The shell is kept for `railway ssh` / `docker exec`.
# Built from the repository root (Railway: RAILWAY_DOCKERFILE_PATH=be/Dockerfile).
#
#   docker build -f be/Dockerfile -t digital-profile-api .
#   start:      /app/api
#   pre-deploy: /app/cli migrate up

FROM golang:1.27-alpine AS build
WORKDIR /src
COPY be/go.mod be/go.sum ./
RUN go mod download
COPY be/ .
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
# Uploads live in the database unless STORAGE_DRIVER says otherwise (local needs a volume).
ENV APP_ENV=production \
    HTTP_ADDR=:8080 \
    LOG_FORMAT=json \
    STORAGE_DRIVER=postgres \
    STORAGE_LOCAL_DIR=/data/storage
USER app
EXPOSE 8080
CMD ["/app/api"]

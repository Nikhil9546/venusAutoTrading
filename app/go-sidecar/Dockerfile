FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
# Populate go.sum entries for anything new (like x/crypto/hkdf)
RUN go mod tidy
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/sidecar main.go

FROM alpine:3.20
WORKDIR /app
COPY --from=build /out/sidecar /usr/local/bin/sidecar
EXPOSE 8081
ENTRYPOINT ["sidecar"]

